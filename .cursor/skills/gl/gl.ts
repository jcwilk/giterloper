/**
 * Thin entry point for the gl skill. All logic lives in lib/.
 * Run: deno run -A lib/gl.ts [args]
 * Or:  deno task gl -- [args]
 */
import { main } from "../../lib/gl.ts";
import { EXIT, GlError } from "../../lib/errors.ts";

try {
  main();
} catch (e) {
  if (e instanceof GlError) {
    console.error(`gl: ${e.message}`);
    Deno.exit(e.code);
  }
  console.error(`gl: unexpected error: ${(e as Error)?.message ?? e}`);
  Deno.exit(EXIT.EXTERNAL);
}
