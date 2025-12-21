/**
 * Migration script: Import existing file-based logs into SQLite database.
 * 
 * Run with: deno run -A server/migrate-logs.ts
 */

import { join } from "@std/path";
import { createRun, finishRun } from "./db.ts";

const LOGS_DIR = "./logs";

async function migrate() {
  console.log("[Migration] Starting log migration from files to SQLite...");
  
  let totalMigrated = 0;
  let errors = 0;

  try {
    // Iterate over pipeline directories
    for await (const pipelineEntry of Deno.readDir(LOGS_DIR)) {
      if (!pipelineEntry.isDirectory) continue;
      
      const pipelineId = pipelineEntry.name;
      const pipelineDir = join(LOGS_DIR, pipelineId);
      
      console.log(`[Migration] Processing pipeline: ${pipelineId}`);
      
      // Iterate over log files in this pipeline
      for await (const logEntry of Deno.readDir(pipelineDir)) {
        if (!logEntry.isFile || !logEntry.name.endsWith(".log")) continue;
        
        try {
          // Parse filename: {runId}_{status}.log
          const [runId, statusPart] = logEntry.name.split("_");
          const status = statusPart.replace(".log", "");
          
          // Read log content
          const logPath = join(pipelineDir, logEntry.name);
          const content = await Deno.readTextFile(logPath);
          
          // Extract duration from log content if present
          const durationMatch = content.match(/Duration: (\d+)ms/);
          const durationMs = durationMatch ? parseInt(durationMatch[1], 10) : 0;
          
          // Create run record
          const dbRunId = createRun(pipelineId, runId);
          
          // Calculate approximate timestamps from runId (which is a timestamp)
          const startedAt = parseInt(runId, 10);
          
          // Finish the run with the log content
          finishRun(dbRunId, status, content, durationMs);
          
          totalMigrated++;
          console.log(`  Migrated: ${logEntry.name}`);
        } catch (e) {
          errors++;
          console.error(`  Error migrating ${logEntry.name}:`, e);
        }
      }
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.log("[Migration] No logs directory found. Nothing to migrate.");
      return;
    }
    throw e;
  }

  console.log(`\n[Migration] Complete!`);
  console.log(`  Migrated: ${totalMigrated} log files`);
  console.log(`  Errors: ${errors}`);
}

if (import.meta.main) {
  await migrate();
}

