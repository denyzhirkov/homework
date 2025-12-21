import { ensureDir } from "@std/fs";
import { join, parse } from "@std/path";

const MODULES_DIR = "./modules";

// Ensure modules dir exists
await ensureDir(MODULES_DIR);

export interface StepModule {
  run: (ctx: any, params: any) => Promise<any>;
}

export async function listModules(): Promise<string[]> {
  const modules: string[] = [];
  try {
    for await (const entry of Deno.readDir(MODULES_DIR)) {
      if (entry.isFile && entry.name.endsWith(".ts")) {
        modules.push(parse(entry.name).name);
      }
    }
  } catch (e) {
    console.error("Error listing modules:", e);
  }
  return modules;
}

export async function loadModule(name: string): Promise<StepModule | null> {
  try {
    // Determine absolute path
    const fullPath = join(Deno.cwd(), MODULES_DIR, `${name}.ts`);
    const importUrl = `file://${fullPath}?v=${Date.now()}`; // Cache busting
    const mod = await import(importUrl);

    if (typeof mod.run !== "function") {
      throw new Error(`Module ${name} does not export a 'run' function.`);
    }

    return mod as StepModule;
  } catch (e) {
    console.error(`Failed to load module ${name}:`, e);
    return null;
  }
}

export async function getModuleSource(name: string): Promise<string> {
  return await Deno.readTextFile(join(MODULES_DIR, `${name}.ts`));
}

export async function saveModule(name: string, content: string): Promise<void> {
  const safeName = parse(name).name; // Prevent directory traversal
  await Deno.writeTextFile(join(MODULES_DIR, `${safeName}.ts`), content);
}

export async function deleteModule(name: string): Promise<void> {
  const safeName = parse(name).name;
  await Deno.remove(join(MODULES_DIR, `${safeName}.ts`));
}
