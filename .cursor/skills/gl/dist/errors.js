/**
 * Error handling and exit codes.
 */
export const EXIT = {
    OK: 0,
    USER: 1,
    STATE: 2,
    EXTERNAL: 3,
};
export class GlError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = "GlError";
        this.code = code;
    }
}
export function fail(message, code = EXIT.USER) {
    throw new GlError(message, code);
}
