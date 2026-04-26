// AI Assistant config — provider catalog + the user's chosen
// provider+model. The API key itself does NOT live here anymore: keys
// are stored on disk by the service in ~/.xarji/config.json and the
// browser only ever knows whether each provider has a key configured
// (via /api/ai/keys). The dashboard's onboarding/settings POST keys
// directly to the service; nothing about the key reaches the JS bundle
// context.

export type AIProviderId = "anthropic" | "openai";

export interface AIProvider {
  id: AIProviderId;
  name: string;
  by: string;
  models: string[];
  defaultModel: string;
  keyHint: string;
  keyPrefix: string;
  docs: string;
  color: string;
}

/** What the dashboard tracks locally — provider id + currently selected
 *  model. The "are we connected" question is answered by the service
 *  (`useAIKeyStatus`), not by this object. */
export interface AIConfig {
  provider: AIProviderId;
  model: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "anthropic",
    name: "Claude",
    by: "Anthropic",
    models: ["claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    defaultModel: "claude-opus-4-7",
    keyHint: "Begins with sk-ant-",
    keyPrefix: "sk-ant-",
    docs: "console.anthropic.com",
    color: "#cc785c",
  },
  {
    id: "openai",
    name: "OpenAI",
    by: "OpenAI",
    models: ["gpt-5", "gpt-5-mini", "gpt-4.1"],
    defaultModel: "gpt-5",
    keyHint: "Begins with sk-",
    keyPrefix: "sk-",
    docs: "platform.openai.com",
    color: "#10a37f",
  },
];

export function getProvider(id: AIProviderId): AIProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

const STORE_KEY = "xarji-ai";
const CHANGE_EVENT = "xarji-ai-changed";

export function loadAIConfig(): AIConfig | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    if (!parsed.provider || !parsed.model) return null;
    if (parsed.provider !== "anthropic" && parsed.provider !== "openai") return null;
    return { provider: parsed.provider, model: parsed.model };
  } catch {
    return null;
  }
}

export function saveAIConfig(cfg: AIConfig) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function clearAIConfig() {
  window.localStorage.removeItem(STORE_KEY);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onAIConfigChange(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

// ─────────────────────────────────────────────────────────────────
// Server-side key management — talks to /api/ai/keys. The service is
// the source of truth; the dashboard only reads presence + sends
// new/updated keys via POST.

export interface AIKeyStatus {
  anthropic: boolean;
  openai: boolean;
}

const KEYS_CHANGE_EVENT = "xarji-ai-keys-changed";

export async function fetchKeyStatus(): Promise<AIKeyStatus> {
  try {
    const res = await fetch("/api/ai/keys");
    if (!res.ok) return { anthropic: false, openai: false };
    const body = (await res.json()) as Partial<AIKeyStatus>;
    return { anthropic: !!body.anthropic, openai: !!body.openai };
  } catch {
    return { anthropic: false, openai: false };
  }
}

export async function saveProviderKey(provider: AIProviderId, apiKey: string): Promise<void> {
  const res = await fetch("/api/ai/keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, apiKey }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to save ${provider} key: ${text}`);
  }
  window.dispatchEvent(new CustomEvent(KEYS_CHANGE_EVENT));
}

export async function deleteProviderKey(provider: AIProviderId): Promise<void> {
  const res = await fetch(`/api/ai/keys/${provider}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to delete ${provider} key: ${text}`);
  }
  window.dispatchEvent(new CustomEvent(KEYS_CHANGE_EVENT));
}

export function onKeyStatusChange(handler: () => void): () => void {
  window.addEventListener(KEYS_CHANGE_EVENT, handler);
  return () => window.removeEventListener(KEYS_CHANGE_EVENT, handler);
}

