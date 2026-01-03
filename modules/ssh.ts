// SSH operations: execute remote commands and copy files.
// Tags: built-in
//
// Usage Example (exec):
// {
//   "module": "ssh",
//   "params": {
//     "op": "exec",
//     "host": "server.example.com",
//     "user": "deploy",
//     "privateKey": "${env.SSH_PRIVATE_KEY}",
//     "cmd": "systemctl restart app"
//   }
// }
//
// Usage Example (scp upload):
// {
//   "module": "ssh",
//   "params": {
//     "op": "scp",
//     "host": "server.example.com",
//     "user": "deploy",
//     "privateKey": "${env.SSH_PRIVATE_KEY}",
//     "source": "./dist/",
//     "destination": "/var/www/app/"
//   }
// }
//
// Full params:
// {
//   "module": "ssh",
//   "params": {
//     "op": "exec",               // Operation: "exec" or "scp" (required)
//     "host": "server.com",       // Remote host (required)
//     "port": 22,                 // SSH port (optional, default: 22)
//     "user": "deploy",           // SSH user (required)
//     "privateKey": "-----BEGIN...", // Private key content (required)
//     "passphrase": "secret",     // Key passphrase (optional)
//     "cmd": "ls -la",            // Command to execute (required for exec)
//     "source": "./local/path",   // Source path for scp (required for scp)
//     "destination": "/remote/path", // Destination path for scp (required for scp)
//     "recursive": true,          // Recursive copy for directories (optional)
//     "timeout": 30000            // Timeout in ms (optional, default: 60000)
//   }
// }
//
// Returns:
// - exec: { "code": 0, "stdout": "...", "stderr": "..." }
// - scp: { "success": true, "files": 5 }
//
// Note: The privateKey should be stored in environment variables for security.
// Supports both RSA and Ed25519 keys.

import type { PipelineContext } from "../server/types/index.ts";
import { join } from "@std/path";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["exec", "scp"],
      description: "SSH operation: exec (run command) or scp (copy files)"
    },
    // Common params (always visible)
    host: {
      type: "string",
      required: true,
      description: "Remote host address"
    },
    port: {
      type: "number",
      required: false,
      default: 22,
      description: "SSH port (default: 22)"
    },
    user: {
      type: "string",
      required: true,
      description: "SSH username"
    },
    privateKey: {
      type: "string",
      required: true,
      description: "SSH private key content (use ${env.SSH_PRIVATE_KEY})"
    },
    passphrase: {
      type: "string",
      required: false,
      description: "Passphrase for encrypted private key"
    },
    timeout: {
      type: "number",
      required: false,
      default: 60000,
      description: "Operation timeout in milliseconds"
    },
    // Exec-specific (visible when op === "exec")
    cmd: {
      type: "string",
      required: false,
      description: "Command to execute on remote host (required for exec)",
      visibleWhen: { param: "op", equals: "exec" }
    },
    // SCP-specific (visible when op === "scp")
    source: {
      type: "string",
      required: false,
      description: "Source path for scp (local file/directory)",
      visibleWhen: { param: "op", equals: "scp" }
    },
    destination: {
      type: "string",
      required: false,
      description: "Destination path for scp (remote path)",
      visibleWhen: { param: "op", equals: "scp" }
    },
    recursive: {
      type: "boolean",
      required: false,
      default: true,
      description: "Recursive copy for directories",
      visibleWhen: { param: "op", equals: "scp" }
    }
  }
};

export interface SSHParams {
  op: "exec" | "scp";
  host: string;
  port?: number;
  user: string;
  privateKey: string;
  passphrase?: string;
  cmd?: string;
  source?: string;
  destination?: string;
  recursive?: boolean;
  timeout?: number;
}

export interface SSHExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SSHScpResult {
  success: true;
  files: number;
}

export async function run(
  ctx: PipelineContext,
  params: SSHParams
): Promise<SSHExecResult | SSHScpResult> {
  if (!params.op) {
    throw new Error("SSH module requires 'op' parameter (exec or scp)");
  }
  if (!params.host) {
    throw new Error("SSH module requires 'host' parameter");
  }
  if (!params.user) {
    throw new Error("SSH module requires 'user' parameter");
  }
  if (!params.privateKey) {
    throw new Error("SSH module requires 'privateKey' parameter");
  }

  const port = params.port || 22;
  const timeout = params.timeout || 60000;

  // Write private key to temporary file (ssh requires file, not string)
  const keyPath = join(ctx.workDir, `.ssh_key_${Date.now()}`);
  try {
    await Deno.writeTextFile(keyPath, params.privateKey);
    // Set permissions to 600 (owner read/write only)
    await Deno.chmod(keyPath, 0o600);

    if (params.op === "exec") {
      return await executeSSH(ctx, params, keyPath, port, timeout);
    } else if (params.op === "scp") {
      return await executeSCP(ctx, params, keyPath, port, timeout);
    }

    throw new Error(`Unknown SSH operation: ${params.op}`);
  } finally {
    // Cleanup: remove temporary key file
    try {
      await Deno.remove(keyPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function executeSSH(
  ctx: PipelineContext,
  params: SSHParams,
  keyPath: string,
  port: number,
  timeout: number
): Promise<SSHExecResult> {
  if (!params.cmd) {
    throw new Error("SSH exec requires 'cmd' parameter");
  }

  if (ctx.log) ctx.log(`[SSH] Executing on ${params.user}@${params.host}:${port}`);
  if (ctx.log) ctx.log(`[SSH] Command: ${params.cmd}`);

  const args = [
    "-i", keyPath,
    "-p", String(port),
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=/dev/null",
    "-o", "BatchMode=yes",
    "-o", `ConnectTimeout=${Math.floor(timeout / 1000)}`,
  ];

  // Add passphrase support via SSH_ASKPASS would require additional complexity
  // For now, we assume key is not password-protected or user handles it

  args.push(`${params.user}@${params.host}`, params.cmd);

  const command = new Deno.Command("ssh", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();
  let killed = false;

  // Handle abort signal
  const abortHandler = () => {
    if (killed) return;
    killed = true;
    try {
      process.kill("SIGKILL");
      if (ctx.log) ctx.log(`[SSH] Process killed by user`);
    } catch {
      // Process may have already exited
    }
  };

  if (ctx.signal) {
    ctx.signal.addEventListener("abort", abortHandler, { once: true });
  }

  // Set up timeout
  const timeoutId = setTimeout(() => {
    if (!killed) {
      killed = true;
      try {
        process.kill("SIGKILL");
        if (ctx.log) ctx.log(`[SSH] Process killed due to timeout`);
      } catch {
        // Ignore
      }
    }
  }, timeout);

  try {
    // Stream output
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    const streamOutput = async (
      readable: ReadableStream<Uint8Array>,
      chunks: string[],
      prefix: string = ""
    ) => {
      const reader = readable.pipeThrough(new TextDecoderStream()).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (killed) break;
          chunks.push(value);
          if (ctx.log) {
            const lines = value.split('\n');
            for (const line of lines) {
              if (line) ctx.log(prefix + line);
            }
          }
        }
      } catch {
        // Ignore read errors if aborted
      } finally {
        reader.releaseLock();
      }
    };

    // Start streaming
    const streamPromise = Promise.all([
      streamOutput(process.stdout, stdoutChunks),
      streamOutput(process.stderr, stderrChunks, "[ERR] "),
    ]);

    const status = await process.status;
    await streamPromise.catch(() => {});

    clearTimeout(timeoutId);

    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }

    if (ctx.signal?.aborted || killed) {
      throw new Error("Pipeline stopped by user");
    }

    const stdout = stdoutChunks.join("");
    const stderr = stderrChunks.join("");

    if (!status.success && status.code !== 0) {
      if (ctx.log) ctx.log(`[SSH] Command exited with code ${status.code}`);
    }

    return {
      code: status.code,
      stdout,
      stderr
    };
  } finally {
    clearTimeout(timeoutId);
    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }
  }
}

async function executeSCP(
  ctx: PipelineContext,
  params: SSHParams,
  keyPath: string,
  port: number,
  timeout: number
): Promise<SSHScpResult> {
  if (!params.source) {
    throw new Error("SSH scp requires 'source' parameter");
  }
  if (!params.destination) {
    throw new Error("SSH scp requires 'destination' parameter");
  }

  // Resolve source path relative to workDir
  const sourcePath = params.source.startsWith("/")
    ? params.source
    : join(ctx.workDir, params.source);

  // Check if source exists
  try {
    await Deno.stat(sourcePath);
  } catch {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const recursive = params.recursive !== false;

  if (ctx.log) ctx.log(`[SSH] SCP: ${sourcePath} -> ${params.user}@${params.host}:${params.destination}`);

  const args = [
    "-i", keyPath,
    "-P", String(port),
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=/dev/null",
    "-o", "BatchMode=yes",
    "-o", `ConnectTimeout=${Math.floor(timeout / 1000)}`,
  ];

  if (recursive) {
    args.push("-r");
  }

  args.push(sourcePath, `${params.user}@${params.host}:${params.destination}`);

  const command = new Deno.Command("scp", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();
  let killed = false;

  // Handle abort signal
  const abortHandler = () => {
    if (killed) return;
    killed = true;
    try {
      process.kill("SIGKILL");
      if (ctx.log) ctx.log(`[SSH] SCP killed by user`);
    } catch {
      // Ignore
    }
  };

  if (ctx.signal) {
    ctx.signal.addEventListener("abort", abortHandler, { once: true });
  }

  // Set up timeout
  const timeoutId = setTimeout(() => {
    if (!killed) {
      killed = true;
      try {
        process.kill("SIGKILL");
        if (ctx.log) ctx.log(`[SSH] SCP killed due to timeout`);
      } catch {
        // Ignore
      }
    }
  }, timeout);

  try {
    // Stream stderr for progress/errors
    const streamStderr = async (readable: ReadableStream<Uint8Array>) => {
      const reader = readable.pipeThrough(new TextDecoderStream()).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (killed) break;
          if (ctx.log) {
            const lines = value.split('\n');
            for (const line of lines) {
              if (line) ctx.log(`[SCP] ${line}`);
            }
          }
        }
      } catch {
        // Ignore
      } finally {
        reader.releaseLock();
      }
    };

    // Consume stdout (usually empty for scp)
    const consumeStdout = async (readable: ReadableStream<Uint8Array>) => {
      const reader = readable.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch {
        // Ignore
      } finally {
        reader.releaseLock();
      }
    };

    await Promise.all([
      consumeStdout(process.stdout),
      streamStderr(process.stderr),
    ]);

    const status = await process.status;
    clearTimeout(timeoutId);

    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }

    if (ctx.signal?.aborted || killed) {
      throw new Error("Pipeline stopped by user");
    }

    if (!status.success) {
      throw new Error(`SCP failed with exit code ${status.code}`);
    }

    // Count files transferred (approximate from source)
    let fileCount = 1;
    try {
      const stat = await Deno.stat(sourcePath);
      if (stat.isDirectory) {
        fileCount = 0;
        for await (const _ of Deno.readDir(sourcePath)) {
          fileCount++;
        }
      }
    } catch {
      // Ignore count errors
    }

    if (ctx.log) ctx.log(`[SSH] SCP completed: ${fileCount} file(s) transferred`);

    return { success: true, files: fileCount };
  } finally {
    clearTimeout(timeoutId);
    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }
  }
}

