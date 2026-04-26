// Returns the service-proxy client for the given provider id. There's
// no longer a per-provider browser SDK to dynamically import — the
// service holds the keys and routes to api.anthropic.com /
// api.openai.com itself. The dashboard speaks SSE to /api/ai/stream
// regardless of which model the user picked.

import { makeServiceProvider } from "./providers/service";
import type { AIProviderClient } from "./types";
import type { AIProviderId } from "../aiConfig";

const cache = new Map<AIProviderId, AIProviderClient>();

export function getProviderClient(id: AIProviderId): AIProviderClient {
  const hit = cache.get(id);
  if (hit) return hit;
  const client = makeServiceProvider(id);
  cache.set(id, client);
  return client;
}
