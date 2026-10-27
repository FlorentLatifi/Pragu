/** Exit codes from the founding brief: 1 means "new issues over the threshold", not a crash. */
export const EXIT = {
  ok: 0,
  issuesFound: 1,
  usage: 2,
  environment: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** An error the user can act on: what happened, and the exact command or step that fixes it. */
export class PraguError extends Error {
  constructor(
    readonly exitCode: ExitCode,
    message: string,
    readonly fix?: string,
  ) {
    super(message);
    this.name = 'PraguError';
  }
}

export function formatError(error: unknown): { text: string; exitCode: ExitCode } {
  if (error instanceof PraguError) {
    const fix = error.fix === undefined ? '' : `\n  Fix: ${error.fix}`;
    return { text: `pragu: ${error.message}${fix}\n`, exitCode: error.exitCode };
  }
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  return {
    text: `pragu: unexpected error. Please report it at https://github.com/FlorentLatifi/Pragu/issues\n${detail}\n`,
    exitCode: EXIT.environment,
  };
}
