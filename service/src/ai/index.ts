// Provider factory. Service-side only — there's no dynamic-import
// trick here because both SDKs ship in the compiled binary regardless
// of which the user picks at runtime. Bundle size matters less than
// startup latency for a long-running daemon.

import { makeAnthropicProvider } from "./anthropic";
import { makeOpenAIProvider } from "./openai";
import type { AIProvider, AIProviderId, AIStreamEvent } from "./types";

const cache = new Map<AIProviderId, AIProvider>();

export function getProvider(id: AIProviderId): AIProvider {
  const hit = cache.get(id);
  if (hit) return hit;
  const provider = id === "anthropic" ? makeAnthropicProvider() : makeOpenAIProvider();
  cache.set(id, provider);
  return provider;
}

/** Serialise an AIStreamEvent as a single SSE record. The dashboard's
 *  proxy provider parses these on the other end. */
export function serialiseEvent(event: AIStreamEvent): string {
  return `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}
