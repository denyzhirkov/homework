import parser from "cron-parser";
import { listPipelines, runPipeline } from "./engine.ts";

export class Scheduler {
  private intervalId: number | null = null;

  // Track execution to prevent double runs within the same minute logic
  // In a real app we'd persist this or use a DB.
  private lastChecks: Map<string, number> = new Map();

  start() {
    console.log("[Scheduler] Started");
    // Run immediately then interval
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 60000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async tick() {
    const now = new Date();
    const pipelines = await listPipelines();

    for (const p of pipelines) {
      if (!p.schedule) continue;

      try {
        // Check if it should run
        const interval = parser.parseExpression(p.schedule);
        const prevDate = interval.prev().toDate();

        // If the scheduled previous run was within the last minute (approx), trigger it.
        // We add a margin of error. 
        const diff = now.getTime() - prevDate.getTime();

        // If it happened in the last 70 seconds
        if (diff < 70000 && diff >= 0) {
          // Dedup: if we already ran for this specific time?
          // We can key by pipelineId + prevDate.getTime()
          const key = `${p.id}-${prevDate.getTime()}`;
          if (!this.lastChecks.has(key)) {
            console.log(`[Scheduler] Triggering scheduled pipeline: ${p.name} (${p.id})`);
            this.lastChecks.set(key, Date.now());

            // Clear old keys to prevent memory leak
            if (this.lastChecks.size > 100) {
              const keys = Array.from(this.lastChecks.keys());
              this.lastChecks.delete(keys[0]);
            }

            runPipeline(p.id).catch(err => {
              console.error(`[Scheduler] Pipeline ${p.name} failed:`, err);
            });
          }
        }
      } catch (e) {
        console.error(`[Scheduler] Error evaluating schedule for ${p.name}:`, e);
      }
    }
  }
}
