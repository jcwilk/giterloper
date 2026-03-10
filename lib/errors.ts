/**
 * Error handling: EXIT codes, GlError, fail.
 */

export const EXIT = {
  OK: 0,
  USER: 1,
  STATE: 2,
  EXTERNAL: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class GlError extends Error {
  constructor(
    message: string,
    public readonly code: number
  ) {
    super(message);
    this.name = "GlError";
    Object.setPrototypeOf(this, GlError.prototype);
  }
}

export function fail(message: string, code: number = EXIT.USER): never {
  throw new GlError(message, code);
}
