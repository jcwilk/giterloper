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

/** Thrown when index metadata does not match requested pin+sha. Maps to MCP stale_index (409). */
export class StaleIndexError extends GlError {
  constructor(
    message: string,
    public readonly pinName: string,
    public readonly sha: string,
    public readonly expectedPinName?: string,
    public readonly expectedSha?: string
  ) {
    super(message, EXIT.STATE);
    this.name = "StaleIndexError";
    Object.setPrototypeOf(this, StaleIndexError.prototype);
  }
}

export function fail(message: string, code: number = EXIT.USER): never {
  throw new GlError(message, code);
}
