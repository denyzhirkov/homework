// File system operations.
// Tags: built-in
//
// Usage Examples:
// Read:
// { "module": "fs", "params": { "op": "read", "path": "./config.json" } }
//
// Write:
// { "module": "fs", "params": { "op": "write", "path": "./out.txt", "content": "data" } }
//
// Returns:
// - Read: string (file content)
// - Write: { "success": true }

import { ensureDir } from "@std/fs";
import { dirname } from "@std/path";
import type { PipelineContext } from "../server/types/index.ts";

export async function run(ctx: PipelineContext, params: { op: "read" | "write"; path: string; content?: string }): Promise<string | { success: true }> {
  if (params.op === "read") {
    return await Deno.readTextFile(params.path);
  } else if (params.op === "write") {
    if (params.content === undefined) throw new Error("Content required for write");
    await ensureDir(dirname(params.path));
    await Deno.writeTextFile(params.path, params.content);
    return { success: true };
  }
  throw new Error(`Unknown op: ${params.op}`);
}
