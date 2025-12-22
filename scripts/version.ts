#!/usr/bin/env -S deno run -A
// Version management script for HomeworkCI
// Usage: deno task version [major|minor|patch|<version>]

const DENO_JSON = "./deno.json";

async function readVersion(): Promise<string> {
  const config = JSON.parse(await Deno.readTextFile(DENO_JSON));
  return config.version || "0.0.0";
}

async function writeVersion(version: string): Promise<void> {
  const config = JSON.parse(await Deno.readTextFile(DENO_JSON));
  config.version = version;
  await Deno.writeTextFile(DENO_JSON, JSON.stringify(config, null, 2) + "\n");
}

function bumpVersion(current: string, type: "major" | "minor" | "patch"): string {
  const [major, minor, patch] = current.split(".").map(Number);
  
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function isValidVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

async function main() {
  const args = Deno.args;
  const current = await readVersion();

  if (args.length === 0) {
    console.log(`Current version: ${current}`);
    console.log("\nUsage:");
    console.log("  deno task version major   # Bump major (1.0.0 -> 2.0.0)");
    console.log("  deno task version minor   # Bump minor (1.0.0 -> 1.1.0)");
    console.log("  deno task version patch   # Bump patch (1.0.0 -> 1.0.1)");
    console.log("  deno task version 2.0.0   # Set specific version");
    return;
  }

  const arg = args[0];
  let newVersion: string;

  if (arg === "major" || arg === "minor" || arg === "patch") {
    newVersion = bumpVersion(current, arg);
  } else if (isValidVersion(arg)) {
    newVersion = arg;
  } else {
    console.error(`Invalid argument: ${arg}`);
    console.error("Use: major, minor, patch, or a version like 1.2.3");
    Deno.exit(1);
  }

  await writeVersion(newVersion);
  console.log(`Version: ${current} -> ${newVersion}`);
  
  // Show git tag command
  console.log(`\nTo create git tag:`);
  console.log(`  git add deno.json`);
  console.log(`  git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`  git tag v${newVersion}`);
  console.log(`  git push origin v${newVersion}`);
}

main();

