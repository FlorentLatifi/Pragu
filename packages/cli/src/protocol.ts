// Agent wire protocol, version 1. Every request is one line of JSON. Every
// response is one header line of JSON, followed by the binary payloads the
// header announces, back to back, with no separators.

export interface PayloadInfo {
  name: string;
  bytes: number;
  type: string;
}

export interface AgentHeader {
  ok: boolean;
  error?: string;
  data?: unknown;
  payloads?: PayloadInfo[];
}

export interface AgentFrame {
  header: AgentHeader;
  payloads: Map<string, Buffer>;
}

export function parseHeader(line: string): AgentHeader {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error(`The agent sent a header that is not JSON: ${line.slice(0, 200)}`);
  }
  if (typeof value !== 'object' || value === null || typeof (value as { ok?: unknown }).ok !== 'boolean') {
    throw new Error(`The agent sent a header without an "ok" flag: ${line.slice(0, 200)}`);
  }
  const header = value as AgentHeader;
  for (const payload of header.payloads ?? []) {
    if (typeof payload.name !== 'string' || !Number.isInteger(payload.bytes) || payload.bytes < 0) {
      throw new Error(`The agent announced an invalid payload: ${JSON.stringify(payload)}`);
    }
  }
  return header;
}

/** Turns a byte stream into frames, however the bytes are split across chunks. */
export class FrameDecoder {
  private buffer = Buffer.alloc(0);
  private pending: AgentHeader | null = null;

  push(chunk: Buffer): AgentFrame[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames: AgentFrame[] = [];
    for (;;) {
      if (this.pending === null) {
        const newline = this.buffer.indexOf(0x0a);
        if (newline === -1) break;
        const line = this.buffer.subarray(0, newline).toString('utf8');
        this.buffer = this.buffer.subarray(newline + 1);
        this.pending = parseHeader(line);
      }
      const announced = this.pending.payloads ?? [];
      const needed = announced.reduce((sum, payload) => sum + payload.bytes, 0);
      if (this.buffer.length < needed) break;
      const payloads = new Map<string, Buffer>();
      let offset = 0;
      for (const payload of announced) {
        payloads.set(payload.name, Buffer.from(this.buffer.subarray(offset, offset + payload.bytes)));
        offset += payload.bytes;
      }
      this.buffer = this.buffer.subarray(needed);
      frames.push({ header: this.pending, payloads });
      this.pending = null;
    }
    return frames;
  }
}
