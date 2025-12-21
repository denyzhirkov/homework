/**
 * Cleanup script: Reset stuck "running" pipeline records and optionally clear all data.
 * 
 * Usage:
 *   deno task cleanup          - Mark stuck "running" records as "cancelled"
 *   deno task cleanup --reset  - Clear all run history (keeps pipelines/modules)
 */

import { db } from "./db.ts";

const args = Deno.args;
const fullReset = args.includes("--reset");

function cleanupStuckRuns() {
  console.log("[Cleanup] Marking stuck 'running' records as 'cancelled'...");
  
  const result = db.prepare(`
    UPDATE runs 
    SET status = 'cancelled', 
        finished_at = ?,
        log_content = COALESCE(log_content, '[Cancelled by cleanup script]')
    WHERE status = 'running'
  `).run(Date.now());
  
  console.log(`[Cleanup] Updated ${result} records.`);
}

function resetAllHistory() {
  console.log("[Cleanup] Deleting all run history...");
  
  db.exec("DELETE FROM steps");
  db.exec("DELETE FROM runs");
  
  // Reset auto-increment counters
  db.exec("DELETE FROM sqlite_sequence WHERE name='runs' OR name='steps'");
  
  console.log("[Cleanup] All history cleared.");
}

function showStats() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM runs
  `).get() as { total: number; running: number; success: number; failed: number; cancelled: number };
  
  console.log("\n[Stats] Current database state:");
  console.log(`  Total runs: ${stats.total}`);
  console.log(`  Running: ${stats.running}`);
  console.log(`  Success: ${stats.success}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Cancelled: ${stats.cancelled}`);
}

if (import.meta.main) {
  console.log("=== HomeworkCI Cleanup ===\n");
  
  if (fullReset) {
    resetAllHistory();
  } else {
    cleanupStuckRuns();
  }
  
  showStats();
  console.log("\nDone!");
  
  db.close();
}

