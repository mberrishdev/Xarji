// Service-proxy provider — talks to xarji-core's /api/ai/stream over
// SSE. The dashboard never holds the API key in JS bundle context;
// the service does, and forwards to api.anthropic.com / api.openai.com
// using whichever SDK matches the requested provider.
//
// Wire format: server emits one SSE record per event, with the JSON
// payload matching this side's AIStreamEvent. We just decode and yield.

import type {
  AIProviderClient,
  AIStreamEvent,
  AIStreamOpts,
} from "../types";
import type { AIProviderId } from "../../aiConfig";

export function makeServiceProvider(id: AIProviderId): AIProviderClient {
  return {
    id,
    async *stream(opts: AIStreamOpts): AsyncIterable<AIStreamEvent> {
      let response: Response;
      try {
        response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify({
            provider: id,
            model: opts.model,
            systemPrompt: opts.systemPrompt,
            messages: opts.messages,
            tools: opts.tools,
          }),
          signal: opts.signal,
        });
      } catch (err) {
        yield { kind: "error", error: err };
        return;
      }

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = await response.json();
          detail = (body && typeof body === "object" && "error" in body && typeof body.error === "string")
            ? body.error
            : detail;
        } catch {
          /* response was not JSON; keep the status text */
        }
        yield { kind: "error", error: new Error(`Service /api/ai/stream returned ${response.status}: ${detail}`) };
        return;
      }

      const body = response.body;
      if (!body) {
        yield { kind: "error", error: new Error("Empty response body from /api/ai/stream") };
        return;
      }

      // Minimal SSE parser. The spec allows comments (`:` lines) and
      // multi-line `data:` records — the service only emits a single
      // `data:` line per record, so the parser stays simple.
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        if (opts.signal?.aborted) {
          await reader.cancel();
          return;
        }
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let recordEnd: number;
        while ((recordEnd = buffer.indexOf("\n\n")) !== -1) {
          const record = buffer.slice(0, recordEnd);
          buffer = buffer.slice(recordEnd + 2);

          let dataLine = "";
          for (const line of record.split("\n")) {
            if (line.startsWith("data:")) {
              dataLine = line.slice(5).trim();
              break;
            }
          }
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine) as AIStreamEvent;
            yield event;
          } catch (err) {
            yield { kind: "error", error: err };
          }
        }
      }
    },
  };
}
