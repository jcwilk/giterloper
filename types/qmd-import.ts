/**
 * Verifies @tobilu/qmd resolves and chunkDocument is correctly typed.
 * Run `npm run typecheck` to ensure the dependency and compilation pass.
 */
import { chunkDocument } from "@tobilu/qmd/dist/store.js";

// Compile-time assertion: chunkDocument returns { text: string; pos: number }[]
type ChunkResult = ReturnType<typeof chunkDocument>;
type _AssertChunkHasText = ChunkResult[number] extends { text: string } ? true : never;
const _: _AssertChunkHasText = true;
export { chunkDocument };
