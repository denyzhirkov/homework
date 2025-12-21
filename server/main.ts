import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { cors } from "hono/cors";
import { listPipelines, loadPipeline, runPipeline, savePipeline } from "./engine.ts";
import { listModules, loadModule, getModuleSource, saveModule } from "./modules.ts";
import { Scheduler } from "./scheduler.ts";

const app = new Hono();

// Logger
app.use("*", async (c, next) => {
  await next();
  console.log(`[${c.req.method}] ${c.req.path} -> ${c.res.status}`);
});

// Enable CORS for frontend during dev (if separate port)
app.use("/*", cors());

const scheduler = new Scheduler();
scheduler.start();

// --- Static Assets (Explicit) ---
// Serve assets with higher priority to avoid fall-through to index.html
app.use("/assets/*", serveStatic({ root: "./client/dist" }));

// --- Pipelines API ---

app.get("/api/pipelines", async (c) => {
  const pipelines = await listPipelines();
  return c.json(pipelines);
});

app.get("/api/pipelines/:id", async (c) => {
  const p = await loadPipeline(c.req.param("id"));
  if (!p) return c.json({ error: "Not found" }, 404);
  return c.json(p);
});

app.post("/api/pipelines/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  // Validate?
  // body.id = id;
  await savePipeline(id, body);
  return c.json({ success: true });
});

app.post("/api/run/:id", async (c) => {
  const id = c.req.param("id");
  console.log(`[API] Triggering pipeline ${id}`);
  try {
    const result = await runPipeline(id);
    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// --- Modules API ---

app.get("/api/modules", async (c) => {
  const modules = await listModules();
  return c.json(modules);
});

app.get("/api/modules/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const source = await getModuleSource(id);
    return c.json({ source });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

app.post("/api/modules/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json(); // Expect { source: string }
  if (typeof body.source !== "string") {
    return c.json({ error: "Missing source" }, 400);
  }
  await saveModule(id, body.source);
  return c.json({ success: true });
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

// --- Static Frontend ---

// Serve static files from client/dist
app.use("/*", serveStatic({ root: "./client/dist" }));

// SPA Fallback: Serve index.html for everything else (that isn't an API call)
app.get("*", serveStatic({ path: "./client/dist/index.html" }));

if (import.meta.main) {
  console.log("Starting NanoCI server on http://localhost:8000");
  Deno.serve({ port: 8000 }, app.fetch);
}

export default app;
