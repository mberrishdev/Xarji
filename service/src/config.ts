import { homedir } from "os";
import { join } from "path";

export interface Config {
  // Messages database path
  messagesDbPath: string;

  // Bank sender IDs to monitor
  bankSenderIds: string[];

  // State database for deduplication
  stateDbPath: string;

  // Local backup path
  localBackupPath: string;

  // InstantDB configuration
  instantdb: {
    enabled: boolean;
    appId: string;
    adminToken: string;
  };

  // Webhook configuration (optional, in addition to InstantDB)
  webhook: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };

  // AI assistant provider keys. Stored on disk in ~/.xarji/config.json
  // so they never reach the browser bundle. The dashboard talks to
  // /api/ai/* and the service forwards to api.anthropic.com /
  // api.openai.com using whichever key is set here.
  aiProviderKeys: {
    anthropic?: string;
    openai?: string;
  };

  // Polling interval in milliseconds (fallback if file watching fails)
  pollIntervalMs: number;
}

const home = homedir();

// Default configuration
export const defaultConfig: Config = {
  messagesDbPath: join(home, "Library", "Messages", "chat.db"),

  bankSenderIds: ["SOLO"],

  stateDbPath: join(home, ".xarji", "state.db"),

  localBackupPath: join(home, ".xarji", "transactions.json"),

  instantdb: {
    enabled: false,
    appId: process.env.INSTANT_APP_ID || "",
    adminToken: process.env.INSTANT_ADMIN_TOKEN || "",
  },

  webhook: {
    enabled: false,
    url: "",
    headers: {
      "Content-Type": "application/json",
    },
  },

  aiProviderKeys: {},

  pollIntervalMs: 60000, // 1 minute fallback
};

// Load config from file if exists, otherwise use defaults.
//
// When no config file is present but the process has valid InstantDB
// credentials in its environment (INSTANT_APP_ID + INSTANT_ADMIN_TOKEN),
// synthesise a config that treats InstantDB as enabled. Without this,
// deployments that rely on env-var configuration would still get
// `enabled: false` in defaults and the parser would skip the InstantDB
// sync target entirely.
export function loadConfig(): Config {
  const configPath = join(home, ".xarji", "config.json");

  try {
    const text = require("fs").readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(text);
    return { ...defaultConfig, ...userConfig };
  } catch {
    // Config file doesn't exist or is invalid.
  }

  const envAppId = process.env.INSTANT_APP_ID || "";
  const envAdminToken = process.env.INSTANT_ADMIN_TOKEN || "";
  if (envAppId && envAdminToken) {
    return {
      ...defaultConfig,
      instantdb: { enabled: true, appId: envAppId, adminToken: envAdminToken },
    };
  }

  return defaultConfig;
}

// Save config to file
export async function saveConfig(config: Partial<Config>): Promise<void> {
  const configDir = join(home, ".xarji");
  const configPath = join(configDir, "config.json");

  // Ensure directory exists
  await Bun.$`mkdir -p ${configDir}`;

  const merged = { ...defaultConfig, ...config };
  await Bun.write(configPath, JSON.stringify(merged, null, 2));
}

// Patch the on-disk config without overwriting the user's other
// settings. Reads the current file, deep-merges the patch, writes back.
// Used by /api/ai/keys so the user can add/rotate provider keys without
// re-running the full setup wizard.
export async function patchConfig(patch: Partial<Config>): Promise<Config> {
  const configDir = join(home, ".xarji");
  const configPath = join(configDir, "config.json");
  await Bun.$`mkdir -p ${configDir}`;

  let current: Config;
  try {
    const text = require("fs").readFileSync(configPath, "utf-8");
    current = { ...defaultConfig, ...JSON.parse(text) };
  } catch {
    current = { ...defaultConfig };
  }

  const next: Config = {
    ...current,
    ...patch,
    instantdb: { ...current.instantdb, ...(patch.instantdb ?? {}) },
    webhook: { ...current.webhook, ...(patch.webhook ?? {}) },
    aiProviderKeys: { ...current.aiProviderKeys, ...(patch.aiProviderKeys ?? {}) },
  };

  await Bun.write(configPath, JSON.stringify(next, null, 2));
  return next;
}

export const CONFIG_DIR = join(home, ".xarji");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const LAUNCHD_PLIST_PATH = join(
  home,
  "Library",
  "LaunchAgents",
  "com.xarji.plist"
);

/**
 * True if a real config file exists on disk. Narrow check — prefer
 * `isConfigured()` unless you specifically care about the file.
 */
export function hasSavedConfig(): boolean {
  try {
    return require("fs").existsSync(CONFIG_PATH);
  } catch {
    return false;
  }
}

/**
 * True if this install has any usable configuration — either a
 * ~/.xarji/config.json written by the setup wizard, or
 * INSTANT_APP_ID + INSTANT_ADMIN_TOKEN env vars for a deployment that
 * prefers environment-driven configuration. When both are absent the
 * service serves just the HTTP layer + onboarding UI so the user can
 * complete setup from the browser.
 */
export function isConfigured(): boolean {
  if (hasSavedConfig()) return true;
  const envAppId = process.env.INSTANT_APP_ID || "";
  const envAdminToken = process.env.INSTANT_ADMIN_TOKEN || "";
  return !!(envAppId && envAdminToken);
}
