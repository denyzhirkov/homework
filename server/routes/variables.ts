// Variables routes - Environment variables management

import { Hono } from "hono";
import { loadVariables, saveVariables, type SSHKeyPair } from "../variables.ts";
import { pubsub } from "../pubsub.ts";

const app = new Hono();

// Get all variables
app.get("/", async (c) => {
  const vars = await loadVariables();
  return c.json(vars);
});

// Save variables
app.post("/", async (c) => {
  try {
    const vars = await c.req.json();
    await saveVariables(vars);
    pubsub.publish({ type: "variables:changed" });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Generate SSH key pair
app.post("/ssh-keys/generate", async (c) => {
  try {
    const { name } = await c.req.json();
    if (!name || typeof name !== "string") {
      return c.json({ error: "Key name is required" }, 400);
    }

    // Normalize name
    const keyName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!keyName) {
      return c.json({ error: "Invalid key name" }, 400);
    }

    // Generate Ed25519 key pair using ssh-keygen
    const keyPair = await generateSSHKeyPair(keyName);

    // Save to config
    const vars = await loadVariables();
    vars.sshKeys = vars.sshKeys || {};
    vars.sshKeys[keyName] = keyPair;
    await saveVariables(vars);
    
    pubsub.publish({ type: "variables:changed" });
    return c.json(keyPair);
  } catch (e) {
    console.error("Failed to generate SSH key:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// Generate SSH key pair using ssh-keygen
async function generateSSHKeyPair(name: string): Promise<SSHKeyPair> {
  const tempDir = await Deno.makeTempDir();
  const keyPath = `${tempDir}/id_ed25519`;

  try {
    // Generate Ed25519 key without passphrase
    const command = new Deno.Command("ssh-keygen", {
      args: [
        "-t", "ed25519",
        "-f", keyPath,
        "-N", "",  // No passphrase
        "-C", `homework-ci-${name}`,  // Comment
        "-q"  // Quiet mode
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const { success, stderr } = await command.output();
    if (!success) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`ssh-keygen failed: ${errorText}`);
    }

    // Read generated keys
    const privateKey = await Deno.readTextFile(keyPath);
    const publicKey = await Deno.readTextFile(`${keyPath}.pub`);

    // Validate key format
    if (!privateKey.includes("BEGIN") || !privateKey.includes("END")) {
      throw new Error("Generated private key has invalid format");
    }

    return {
      privateKey: privateKey, // Keep as-is with trailing newline
      publicKey: publicKey.trim(), // Public key can be trimmed
    };
  } finally {
    // Cleanup temp directory
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export default app;

