import { ensureDir } from "@std/fs";
import { dirname } from "@std/path";

export async function run(ctx: any, params: { op: "read" | "write" | "delete", path: string, content?: string }) {
  const filePath = params.path; // Absolute or relative? 
  // Ideally relative to workspace. 
  // For now assuming path is either absolute or relative to CWD.

  if (params.op === "read") {
    const data = await Deno.readTextFile(filePath);
    return { content: data };
  } else if (params.op === "write") {
    if (params.content === undefined) throw new Error("Content required for write op");
    await ensureDir(dirname(filePath));
    await Deno.writeTextFile(filePath, params.content);
    return { success: true };
  } else if (params.op === "delete") {
    await Deno.remove(filePath);
    return { success: true };
  } else {
    throw new Error(`Unknown op: ${params.op}`);
  }
}
