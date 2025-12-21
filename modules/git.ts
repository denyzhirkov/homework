
export async function run(ctx: any, params: { op: "clone" | "pull", repo?: string, dir?: string }) {
  // Only basic git support for now
  const cmd = params.op === "clone"
    ? ["git", "clone", params.repo!, params.dir || "."]
    : ["git", "pull"];

  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd: ctx.workDir, // Assuming ctx has workDir
  });

  const output = await command.output();
  if (!output.success) {
    throw new Error(`Git ${params.op} failed`);
  }
  return { success: true };
}
