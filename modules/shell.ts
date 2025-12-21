
export async function run(ctx: any, params: { cmd: string | string[], cwd?: string }) {
  const cmdLine = Array.isArray(params.cmd) ? params.cmd : [params.cmd];

  // Use 'sh -c' or 'cmd /c' to support shell strings if needed, 
  // but Deno.Command usage is safer if we parse args.
  // For simplicity/power, let's assume the user accepts shell splitting if they pass a string,
  // OR we can wrap in sh -c.

  let cmd: string[];
  let program: string;
  let args: string[];

  if (params.cmdRaw) {
    // If user specifically wants raw shell execution
    if (Deno.build.os === "windows") {
      program = "cmd";
      args = ["/c", params.cmdRaw];
    } else {
      program = "sh";
      args = ["-c", params.cmdRaw];
    }
  } else {
    // Simple splitting or usage of array
    // To be truly robust similar to 'exec', we might want sh -c by default for string input.
    // Let's stick to Deno.Command default behavior:
    // If string, we can't easily execute complex pipes without sh/cmd.
    // We'll require array for complex args, or implement a simple splitter?
    // Let's use 'sh -c' logic for string inputs to be "user friendly" for pipes/redirections.
    if (typeof params.cmd === 'string') {
      if (Deno.build.os === "windows") {
        program = "cmd";
        args = ["/c", params.cmd];
      } else {
        program = "sh";
        args = ["-c", params.cmd];
      }
    } else {
      // Array
      program = params.cmd[0];
      args = params.cmd.slice(1);
    }
  }

  console.log(`[Shell] Running: ${program} ${args.join(" ")}`);

  const command = new Deno.Command(program, {
    args: args,
    cwd: params.cwd || ctx.cwd,
    stdout: "piped",
    stderr: "piped",
  });

  const output = await command.output();
  const outStr = new TextDecoder().decode(output.stdout);
  const errStr = new TextDecoder().decode(output.stderr);

  // Log output (could be streamed in a better implementation)
  if (outStr) console.log(outStr);
  if (errStr) console.error(errStr);

  if (!output.success) {
    throw new Error(`Command failed with code ${output.code}: ${errStr}`);
  }

  return { stdout: outStr, stderr: errStr, code: output.code };
}
