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

  pollIntervalMs: 60000, // 1 minute fallback
};

// Load config from file if exists, otherwise use defaults
export function loadConfig(): Config {
  const configPath = join(home, ".xarji", "config.json");

  try {
    const file = Bun.file(configPath);
    // Use sync read for initialization
    const text = require("fs").readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(text);
    return { ...defaultConfig, ...userConfig };
  } catch {
    // Config file doesn't exist or is invalid, use defaults
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

export const CONFIG_DIR = join(home, ".xarji");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const LAUNCHD_PLIST_PATH = join(
  home,
  "Library",
  "LaunchAgents",
  "com.xarji.plist"
);

/**
 * True if a real config file exists on disk. The service treats the
 * absence of ~/.xarji/config.json as "unconfigured" and serves just the
 * HTTP layer + onboarding UI until the user completes setup, rather
 * than silently running against baked-in defaults.
 */
export function hasSavedConfig(): boolean {
  try {
    return require("fs").existsSync(CONFIG_PATH);
  } catch {
    return false;
  }
}
