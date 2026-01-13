import { Hono } from "hono";
import { config } from "../config.ts";
import { getVersion } from "../utils/version.ts";
import { checkForUpdate } from "../utils/github-updates.ts";
import { syncDefaultFiles } from "../utils/sync-defaults.ts";
import { exists } from "@std/fs";
import { join } from "@std/path";

const app = new Hono();

/**
 * Check if repository path is accessible
 */
async function checkRepoAccess(repoPath: string): Promise<boolean> {
  try {
    if (await exists(repoPath)) {
      // Check if it's a git repository
      const gitDir = join(repoPath, ".git");
      return await exists(gitDir);
    }
  } catch (e) {
    console.error(`Failed to check repo access:`, e);
  }
  return false;
}

/**
 * Execute git pull in repository
 */
async function gitPull(repoPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new Deno.Command("git", {
      args: ["-C", repoPath, "pull", "origin", "main"],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Read version from deno.json in repository
 */
async function readRepoVersion(repoPath: string): Promise<string | null> {
  try {
    const denoJsonPath = join(repoPath, "deno.json");
    if (await exists(denoJsonPath)) {
      const text = await Deno.readTextFile(denoJsonPath);
      const denoConfig = JSON.parse(text);
      return denoConfig.version || null;
    }
  } catch (e) {
    console.error(`Failed to read repo version:`, e);
  }
  return null;
}

// GET /api/updates/check - Check for available updates
app.get("/check", async (c) => {
  try {
    if (!config.githubRepo) {
      return c.json({
        error: "GitHub repository not configured. Set GITHUB_REPO environment variable.",
      }, 400);
    }

    const currentVersion = await getVersion();
    const updateInfo = await checkForUpdate(config.githubRepo, currentVersion);

    // Check if auto-update is possible
    const repoPath = config.repoPath ? "/app/repo" : null;
    const canAutoUpdate = repoPath ? await checkRepoAccess(repoPath) : false;

    return c.json({
      available: updateInfo.available,
      current: updateInfo.current,
      latest: updateInfo.latest,
      canAutoUpdate,
    });
  } catch (e) {
    console.error("Error checking for updates:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// POST /api/updates/apply - Apply update
app.post("/apply", async (c) => {
  try {
    if (!config.githubRepo) {
      return c.json({
        error: "GitHub repository not configured",
      }, 400);
    }

    const currentVersion = await getVersion();
    const updateInfo = await checkForUpdate(config.githubRepo, currentVersion);

    if (!updateInfo.available || !updateInfo.latest) {
      return c.json({
        error: "No update available",
      }, 400);
    }

    // Check if auto-update is possible
    const repoPath = config.repoPath ? "/app/repo" : null;
    const canAutoUpdate = repoPath ? await checkRepoAccess(repoPath) : false;

    if (canAutoUpdate && config.autoUpdateEnabled) {
      // Automatic update mode
      try {
        // 1. Create backup (using existing backup endpoint)
        // Note: We could call the backup endpoint internally, but for simplicity
        // we'll just proceed with the update. User should create backup manually if needed.
        console.log("[Update] Starting automatic update...");

        // 2. Git pull
        const pullResult = await gitPull(repoPath!);
        if (!pullResult.success) {
          return c.json({
            error: `Git pull failed: ${pullResult.error}`,
            manual: false,
          }, 500);
        }

        // 3. Verify version was updated
        const newVersion = await readRepoVersion(repoPath!);
        if (!newVersion || newVersion === currentVersion) {
          return c.json({
            error: "Version was not updated after git pull",
            manual: false,
          }, 500);
        }

        // 4. Sync default files
        const syncResult = await syncDefaultFiles(repoPath);

        return c.json({
          success: true,
          message: "Update applied successfully. Please restart containers to complete the update.",
          currentVersion,
          newVersion,
          syncResult,
          instructions: [
            "Update has been applied to the repository",
            "Run: docker compose up -d --build",
            "Or restart containers manually",
          ],
        });
      } catch (e) {
        console.error("Error during automatic update:", e);
        return c.json({
          error: `Automatic update failed: ${String(e)}`,
          manual: false,
        }, 500);
      }
    } else {
      // Manual update mode
      return c.json({
        success: false,
        manual: true,
        currentVersion: updateInfo.current,
        latestVersion: updateInfo.latest,
        instructions: [
          "1. SSH into the server",
          "2. Navigate to the repository directory",
          "3. Run: git pull",
          "4. Run: docker compose up -d --build",
          "5. Or use the sync-defaults endpoint to sync files after manual update",
        ],
      });
    }
  } catch (e) {
    console.error("Error applying update:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// POST /api/updates/sync-defaults - Sync default files
app.post("/sync-defaults", async (c) => {
  try {
    const repoPath = config.repoPath ? "/app/repo" : null;

    if (!repoPath) {
      return c.json({
        error: "Repository path not configured. Set REPO_PATH environment variable.",
      }, 400);
    }

    if (!(await checkRepoAccess(repoPath))) {
      return c.json({
        error: "Repository not accessible or not a git repository",
      }, 400);
    }

    const syncResult = await syncDefaultFiles(repoPath);

    return c.json({
      success: true,
      ...syncResult,
    });
  } catch (e) {
    console.error("Error syncing defaults:", e);
    return c.json({ error: String(e) }, 500);
  }
});

export default app;
