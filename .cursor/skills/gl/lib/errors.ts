/**
 * Error types and exit handling.
 */

export const EXIT = {
  OK: 0,
  USER: 1,
  STATE: 2,
  EXTERNAL: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class GlError extends Error {
  /** @param message - Error message
   *  @param code - Exit code (EXIT.USER, EXIT.STATE, EXIT.EXTERNAL)
   */
  constructor(
    message: string,
    public code: number
  ) {
    super(message);
    this.name = "GlError";
  }
}

export function fail(message: string, code: number = EXIT.USER): never {
  throw new GlError(message, code);
}
