// HTTP Requests.
// Tags: built-in
//
// Usage Example:
// {
//   "module": "http",
//   "params": {
//     "url": "https://api.example.com/data",
//     "method": "POST",
//     "body": { "key": "value" }
//   }
// }
//
// Returns: JSON object or string (response body)

import type { PipelineContext, ModuleResult } from "../server/types/index.ts";

export async function run(ctx: PipelineContext, params: { url: string; method?: string; body?: unknown }): Promise<ModuleResult> {
  try {
    const res = await fetch(params.url, {
      method: params.method || "GET",
      body: params.body ? JSON.stringify(params.body) : undefined,
      headers: params.body ? { "Content-Type": "application/json" } : undefined,
      signal: ctx.signal, // Pass AbortSignal to fetch
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (e: any) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}
