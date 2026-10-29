import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import type { Socket } from 'node:net';
import type { Adb } from './adb.js';
import { EXIT, PraguError } from './errors.js';
import { FrameDecoder } from './protocol.js';
import type { AgentFrame } from './protocol.js';

export const AGENT_PACKAGE = 'dev.pragu.agent';
const INSTRUMENTATION = `${AGENT_PACKAGE}/.PraguInstrumentation`;
const CONNECT_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 300;

/** One request/response conversation with the on-device agent over an adb-forwarded socket. */
class AgentClient {
  private readonly decoder = new FrameDecoder();
  private readonly frames: AgentFrame[] = [];
  private waiter: { resolve: (frame: AgentFrame) => void; reject: (error: Error) => void } | null = null;
  private failure: Error | null = null;

  constructor(private readonly socket: Socket) {
    socket.on('data', (chunk: Buffer) => {
      try {
        this.frames.push(...this.decoder.push(chunk));
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      this.flush();
    });
    socket.on('error', (error) => {
      this.fail(error);
    });
    socket.on('close', () => {
      this.fail(
        new PraguError(
          EXIT.environment,
          'The Pragu agent stopped in the middle of a capture.',
          'Run "pragu doctor", then scan again. If it keeps happening, look in "adb logcat" for a crash of dev.pragu.agent or of the app.',
        ),
      );
    });
  }

  private flush(): void {
    const frame = this.frames.shift();
    if (frame !== undefined && this.waiter !== null) {
      const { resolve } = this.waiter;
      this.waiter = null;
      resolve(frame);
    } else if (frame !== undefined) {
      this.frames.unshift(frame);
    }
  }

  private fail(error: Error): void {
    this.failure ??= error;
    if (this.waiter !== null) {
      const { reject } = this.waiter;
      this.waiter = null;
      reject(error);
    }
  }

  request(command: Record<string, unknown>, timeoutMs: number): Promise<AgentFrame> {
    if (this.failure !== null) return Promise.reject(this.failure);
    return new Promise<AgentFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error(`The agent did not answer "${String(command.cmd)}" within ${String(timeoutMs / 1000)} s.`));
      }, timeoutMs);
      this.waiter = {
        resolve: (frame) => {
          clearTimeout(timer);
          resolve(frame);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      this.socket.write(`${JSON.stringify(command)}\n`);
      this.flush();
    });
  }

  close(): void {
    this.socket.destroy();
  }
}

function openSocket(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => {
      resolve(socket);
    });
    socket.once('error', reject);
  });
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface AgentSession {
  request(command: Record<string, unknown>, timeoutMs?: number): Promise<AgentFrame>;
  close(): Promise<void>;
}

/**
 * Starts the agent's instrumentation on the device and connects to it. adb
 * accepts a forwarded connection even before the agent listens, then drops it,
 * so readiness is "a hello got an answer", retried until the deadline.
 */
export async function startAgentSession(adb: Adb): Promise<AgentSession> {
  const socketName = `pragu-${randomUUID().slice(0, 8)}`;
  await adb.shell(['am', 'force-stop', AGENT_PACKAGE]);
  const instrumentation = adb.spawnShell(['am', 'instrument', '-w', '-e', 'socket', socketName, INSTRUMENTATION]);
  // Mutated by process events; an object keeps TypeScript from narrowing `exited` to always-false.
  const instrumentationState = { output: '', exited: false };
  instrumentation.stdout.on('data', (chunk: Buffer) => (instrumentationState.output += chunk.toString()));
  instrumentation.stderr.on('data', (chunk: Buffer) => (instrumentationState.output += chunk.toString()));
  instrumentation.on('exit', () => (instrumentationState.exited = true));

  const port = Number((await adb.run(['forward', 'tcp:0', `localabstract:${socketName}`])).trim());
  const cleanup = async () => {
    await adb.run(['forward', '--remove', `tcp:${String(port)}`]).catch(() => undefined);
    instrumentation.kill();
  };

  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  for (;;) {
    if (instrumentationState.exited) {
      await cleanup();
      throw new PraguError(
        EXIT.environment,
        `The Pragu agent stopped before it was ready: ${instrumentationState.output.trim() || 'no output'}`,
        'Rebuild the agent with "pnpm agent:build" and scan again, or check "adb logcat -s PraguAgent".',
      );
    }
    try {
      const client = new AgentClient(await openSocket(port));
      const hello = await client.request({ cmd: 'hello' }, 2_000);
      if (!hello.header.ok) throw new Error(hello.header.error ?? 'hello failed');
      return {
        request: async (command, timeoutMs = 60_000) => {
          const frame = await client.request(command, timeoutMs);
          if (!frame.header.ok) {
            throw new PraguError(
              EXIT.environment,
              `The agent could not ${String(command.cmd)}: ${frame.header.error ?? 'unknown error'}`,
            );
          }
          return frame;
        },
        close: async () => {
          await client.request({ cmd: 'shutdown' }, 5_000).catch(() => undefined);
          client.close();
          await cleanup();
        },
      };
    } catch {
      if (Date.now() > deadline) {
        await cleanup();
        throw new PraguError(
          EXIT.environment,
          `Could not reach the Pragu agent on the device within ${String(CONNECT_TIMEOUT_MS / 1000)} s.`,
          'Check "adb logcat -s PraguAgent" for the reason.',
        );
      }
      await sleep(RETRY_DELAY_MS);
    }
  }
}
