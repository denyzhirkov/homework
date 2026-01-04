// Settings routes - System backup and restore

import { Hono } from "hono";
import JSZip from "jszip";
import { join, parse } from "@std/path";
import { listPipelines, isDemoPipeline } from "../pipeline-repository.ts";
import { loadVariables } from "../variables.ts";
import { listModules, isBuiltInModule, getModuleSource } from "../modules.ts";
import { config } from "../config.ts";

const app = new Hono();

// Export backup - GET /api/settings/backup/export
app.get("/backup/export", async (c) => {
  try {
    const zip = new JSZip();
    const pipelinesFolder = zip.folder("pipelines");
    const modulesFolder = zip.folder("modules");

    // 1. Collect all pipelines (excluding demo)
    const pipelines = await listPipelines();
    const nonDemoPipelines = pipelines.filter((p) => !isDemoPipeline(p.id));

    for (const pipeline of nonDemoPipelines) {
      const { id, ...pipelineData } = pipeline;
      const filename = `${id}.json`;
      pipelinesFolder?.file(filename, JSON.stringify(pipelineData, null, 2));
    }

    // 2. Load variables
    const variables = await loadVariables();
    zip.file("variables.json", JSON.stringify(variables, null, 2));

    // 3. Collect custom modules (excluding built-in)
    const allModules = await listModules();
    const customModules = allModules.filter((m) => !isBuiltInModule(m.id));

    for (const module of customModules) {
      try {
        const source = await getModuleSource(module.id);
        modulesFolder?.file(`${module.id}.ts`, source);
      } catch (e) {
        console.error(`Failed to read module ${module.id}:`, e);
        // Continue with other modules
      }
    }

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `backup-${timestamp}.zip`;

    // Return file with proper headers
    return new Response(zipBlob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Error creating backup:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// Import backup - POST /api/settings/backup/import
app.post("/backup/import", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    if (!file.name.endsWith(".zip")) {
      return c.json({ error: "File must be a ZIP archive" }, 400);
    }

    // Read ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const results = {
      pipelines: { success: 0, failed: 0, errors: [] as string[] },
      modules: { success: 0, failed: 0, errors: [] as string[] },
      variables: { success: false, error: "" as string | undefined },
    };

    // 1. Restore pipelines
    // Process all files in ZIP and filter those in pipelines/ folder
    const pipelineFiles: string[] = [];
    zip.forEach((relativePath, file) => {
      // Only process files (not directories) that are in pipelines/ folder
      if (!file.dir && relativePath.startsWith("pipelines/") && relativePath.endsWith(".json")) {
        // Extract filename from path (e.g., "pipelines/my-pipeline.json" -> "my-pipeline.json")
        const fileName = relativePath.replace("pipelines/", "");
        // Exclude variables.json if it somehow ended up in pipelines folder
        if (fileName !== "variables.json") {
          pipelineFiles.push(relativePath);
        }
      }
    });

    for (const relativePath of pipelineFiles) {
      try {
        const file = zip.file(relativePath);
        if (!file) continue;

        const content = await file.async("string");
        const pipelineData = JSON.parse(content);
        
        // Extract ID from filename (e.g., "pipelines/my-pipeline.json" -> "my-pipeline")
        const fileName = relativePath.replace("pipelines/", "");
        const id = parse(fileName).name;

        // Validate pipeline structure
        if (!pipelineData.name || !pipelineData.steps) {
          throw new Error("Invalid pipeline structure");
        }

        // Import pipeline using repository
        const { savePipeline } = await import("../pipeline-repository.ts");
        await savePipeline(id, pipelineData);
        results.pipelines.success++;
      } catch (e) {
        results.pipelines.failed++;
        const fileName = relativePath.replace("pipelines/", "");
        results.pipelines.errors.push(`${fileName}: ${String(e)}`);
        console.error(`Failed to import pipeline ${relativePath}:`, e);
      }
    }

    // 2. Restore variables
    const variablesFile = zip.file("variables.json");
    if (variablesFile) {
      try {
        const content = await variablesFile.async("string");
        const variables = JSON.parse(content);

        // Validate structure
        if (typeof variables !== "object" || !variables.global || !variables.environments) {
          throw new Error("Invalid variables structure");
        }

        const { saveVariables } = await import("../variables.ts");
        await saveVariables(variables);
        results.variables.success = true;
      } catch (e) {
        results.variables.success = false;
        results.variables.error = String(e);
        console.error("Failed to import variables:", e);
      }
    } else {
      results.variables.error = "variables.json not found in backup";
    }

    // 3. Restore custom modules
    // Process all files in ZIP and filter those in modules/ folder
    const moduleFiles: string[] = [];
    zip.forEach((relativePath, file) => {
      // Only process files (not directories) that are in modules/ folder
      if (!file.dir && relativePath.startsWith("modules/") && relativePath.endsWith(".ts")) {
        moduleFiles.push(relativePath);
      }
    });

    for (const relativePath of moduleFiles) {
      try {
        const file = zip.file(relativePath);
        if (!file) continue;

        const content = await file.async("string");
        
        // Extract module name from path (e.g., "modules/my-module.ts" -> "my-module")
        const fileName = relativePath.replace("modules/", "");
        const moduleName = parse(fileName).name;

        // Prevent directory traversal
        const safeName = parse(moduleName).name;
        if (safeName !== moduleName) {
          throw new Error("Invalid module name");
        }

        // Don't overwrite built-in modules
        if (isBuiltInModule(safeName)) {
          results.modules.errors.push(`${safeName}: Cannot overwrite built-in module`);
          continue;
        }

        const { saveModule } = await import("../modules.ts");
        await saveModule(safeName, content);
        results.modules.success++;
      } catch (e) {
        results.modules.failed++;
        const fileName = relativePath.replace("modules/", "");
        results.modules.errors.push(`${fileName}: ${String(e)}`);
        console.error(`Failed to import module ${relativePath}:`, e);
      }
    }

    // Publish events for UI updates
    const { pubsub } = await import("../pubsub.ts");
    if (results.pipelines.success > 0) {
      pubsub.publish({ type: "pipelines:changed" });
    }
    if (results.variables.success) {
      pubsub.publish({ type: "variables:changed" });
    }
    if (results.modules.success > 0) {
      pubsub.publish({ type: "modules:changed" });
    }

    return c.json({
      success: true,
      pipelines: results.pipelines.success,
      modules: results.modules.success,
      variables: results.variables.success,
      details: {
        pipelines: {
          success: results.pipelines.success,
          failed: results.pipelines.failed,
          errors: results.pipelines.errors,
        },
        modules: {
          success: results.modules.success,
          failed: results.modules.failed,
          errors: results.modules.errors,
        },
        variables: {
          success: results.variables.success,
          error: results.variables.error,
        },
      },
    });
  } catch (e) {
    console.error("Error importing backup:", e);
    return c.json({ error: String(e) }, 500);
  }
});

export default app;

