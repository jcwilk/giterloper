/**
 * Exit codes and error handling.
 */

export const EXIT = {
  OK: 0,
  USER: 1,
  STATE: 2,
  EXTERNAL: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class GlError extends Error {
  code: ExitCode;
  constructor(message: string, code: ExitCode) {
    super(message);
    this.code = code;
  }
}

export function fail(message: string, code: ExitCode = EXIT.USER): never {
  throw new GlError(message, code);
}
