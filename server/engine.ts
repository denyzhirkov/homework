import { ensureDir } from "@std/fs";
import { join, parse } from "@std/path";
import { loadModule } from "./modules.ts";

const PIPELINES_DIR = "./pipelines";
await ensureDir(PIPELINES_DIR);

export interface Pipeline {
  id: string; // Filename (without extension)
  name: string;
  schedule?: string;
  steps: PipelineStep[];
}

export interface PipelineStep {
  id?: string;
  description?: string;
  module: string;
  params?: Record<string, any>;
}

export async function loadPipeline(id: string): Promise<Pipeline | null> {
  try {
    const text = await Deno.readTextFile(join(PIPELINES_DIR, `${id}.json`));
    const pipeline = JSON.parse(text);
    pipeline.id = id;
    return pipeline;
  } catch (e) {
    console.error(`Failed to load pipeline ${id}:`, e);
    return null;
  }
}

export async function savePipeline(id: string, pipeline: Omit<Pipeline, "id">) {
  await Deno.writeTextFile(join(PIPELINES_DIR, `${id}.json`), JSON.stringify(pipeline, null, 2));
}

export async function listPipelines(): Promise<Pipeline[]> {
  const pipelines: Pipeline[] = [];
  try {
    for await (const entry of Deno.readDir(PIPELINES_DIR)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const id = parse(entry.name).name;
        const p = await loadPipeline(id);
        if (p) pipelines.push(p);
      }
    }
  } catch (e) {
    console.error("Error listing pipelines:", e);
  }
  return pipelines;
}

export async function runPipeline(id: string) {
  const pipeline = await loadPipeline(id);
  if (!pipeline) throw new Error(`Pipeline ${id} not found`);

  console.log(`[Engine] Starting pipeline: ${pipeline.name} (${id})`);

  // Context shared between steps
  const ctx = {
    cwd: Deno.cwd(),
    workDir: Deno.cwd(), // In a real CI this would be a fresh tmp dir
    env: Deno.env.toObject(),
    results: {} as Record<string, any>,
    pipelineId: id,
    startTime: Date.now(),
  };

  // We should probably log this to a file or stream it
  // For now, console logs.

  for (const step of pipeline.steps) {
    const stepName = step.description || step.module;
    console.log(`[Engine] Running step: ${stepName}`);

    try {
      const mod = await loadModule(step.module);
      if (!mod) {
        throw new Error(`Module '${step.module}' not found`);
      }

      // Resolve params? e.g. ${results.step1.output}
      // Skipping complex interpolation for now (Minimalist).

      const result = await mod.run(ctx, step.params || {});

      if (step.id) {
        ctx.results[step.id] = result;
      }
    } catch (e) {
      console.error(`[Engine] Step '${stepName}' failed:`, e);
      throw new Error(`Step '${stepName}' failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`[Engine] Pipeline finished: ${pipeline.name}`);
  return { success: true, duration: Date.now() - ctx.startTime };
}
