// GitHub Updates Utility
// Checks for available updates via GitHub API

interface VersionCache {
  version: string;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const versionCache = new Map<string, VersionCache>();

/**
 * Parse version from tag name (supports "v1.2.3" or "1.2.3")
 */
function parseVersion(tagName: string): string | null {
  // Remove 'v' prefix if present
  const cleaned = tagName.startsWith("v") ? tagName.slice(1) : tagName;
  
  // Validate semver format (x.y.z)
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

/**
 * Compare two version strings (semver)
 * Returns: 1 if latest > current, 0 if equal, -1 if latest < current
 */
export function compareVersions(current: string, latest: string): number {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) return 1;
    if (latestPart < currentPart) return -1;
  }
  
  return 0;
}

/**
 * Get latest version from GitHub Releases API
 */
async function getLatestRelease(repo: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "HomeworkCI",
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // No releases found, try tags
        return null;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    const version = parseVersion(data.tag_name || data.name || "");
    
    return version;
  } catch (e) {
    console.error(`Failed to fetch latest release for ${repo}:`, e);
    return null;
  }
}

/**
 * Get latest version from GitHub Tags API
 */
async function getLatestTag(repo: string): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${repo}/tags?per_page=1`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "HomeworkCI",
      },
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    
    const version = parseVersion(data[0].name);
    return version;
  } catch (e) {
    console.error(`Failed to fetch latest tag for ${repo}:`, e);
    return null;
  }
}

/**
 * Check GitHub for latest version
 * Uses caching to avoid excessive API calls
 */
export async function checkGitHubVersion(repo: string): Promise<string | null> {
  // Check cache first
  const cached = versionCache.get(repo);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.version;
  }
  
  // Try releases first
  let version = await getLatestRelease(repo);
  
  // Fallback to tags if no releases
  if (!version) {
    version = await getLatestTag(repo);
  }
  
  // Update cache if we got a version
  if (version) {
    versionCache.set(repo, {
      version,
      timestamp: Date.now(),
    });
  }
  
  return version;
}

/**
 * Check if update is available
 * Returns: { available: boolean, current: string, latest: string | null }
 */
export async function checkForUpdate(
  repo: string,
  currentVersion: string
): Promise<{ available: boolean; current: string; latest: string | null }> {
  const latestVersion = await checkGitHubVersion(repo);
  
  if (!latestVersion) {
    return {
      available: false,
      current: currentVersion,
      latest: null,
    };
  }
  
  const comparison = compareVersions(currentVersion, latestVersion);
  const available = comparison > 0;
  
  return {
    available,
    current: currentVersion,
    latest: latestVersion,
  };
}
