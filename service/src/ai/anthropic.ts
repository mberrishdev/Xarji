// Anthropic provider — runs inside xarji-core. The browser never sees
// the API key; it sends a generic AIStreamRequest to /api/ai/stream and
// the service forwards to api.anthropic.com using the key stored in
// ~/.xarji/config.json.

import Anthropic from "@anthropic-ai/sdk";
import type {
  AICoreMessage,
  AIProvider,
  AIStopReason,
  AIStreamEvent,
  AIToolDefinition,
} from "./types";

export function makeAnthropicProvider(): AIProvider {
  return {
    id: "anthropic",
    async *stream(opts): AsyncIterable<AIStreamEvent> {
      const client = new Anthropic({ apiKey: opts.apiKey });
      const messages = opts.messages.map(toAnthropicMessage);
      const tools = opts.tools.map((t: AIToolDefinition) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
      }));

      const toolBuffers = new Map<number, { id: string; name: string; jsonText: string }>();
      let stopReason: AIStopReason = "other";

      const stream = client.messages.stream({
        model: opts.model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: opts.systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      });

      try {
        for await (const event of stream) {
          if (opts.signal?.aborted) {
            stream.controller.abort();
            return;
          }

          if (event.type === "content_block_start") {
            if (event.content_block.type === "tool_use") {
              toolBuffers.set(event.index, {
                id: event.content_block.id,
                name: event.content_block.name,
                jsonText: "",
              });
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              yield { kind: "text-delta", text: event.delta.text };
            } else if (event.delta.type === "input_json_delta") {
              const buf = toolBuffers.get(event.index);
              if (buf) buf.jsonText += event.delta.partial_json;
            }
          } else if (event.type === "content_block_stop") {
            const buf = toolBuffers.get(event.index);
            if (buf) {
              let input: unknown;
              try {
                input = buf.jsonText ? JSON.parse(buf.jsonText) : {};
              } catch {
                input = { __parseError: buf.jsonText };
              }
              yield { kind: "tool-call", id: buf.id, name: buf.name, input };
              toolBuffers.delete(event.index);
            }
          } else if (event.type === "message_delta") {
            if (event.delta.stop_reason) {
              stopReason = mapStopReason(event.delta.stop_reason);
            }
          }
        }
      } catch (err) {
        yield { kind: "error", error: err instanceof Error ? err.message : String(err) };
        return;
      }

      yield { kind: "stop", reason: stopReason };
    },
  };
}

function toAnthropicMessage(m: AICoreMessage): Anthropic.MessageParam {
  if (m.role === "user") {
    if (typeof m.content === "string") {
      return { role: "user", content: m.content };
    }
    return {
      role: "user",
      content: m.content.map((p) => {
        if (p.type === "text") return { type: "text", text: p.text };
        if (p.type === "tool_result") {
          return {
            type: "tool_result",
            tool_use_id: p.toolUseId,
            content: p.output,
            is_error: p.isError,
          };
        }
        return { type: "text", text: "" };
      }),
    };
  }
  return {
    role: "assistant",
    content: m.content.map((p) => {
      if (p.type === "text") return { type: "text", text: p.text };
      if (p.type === "tool_use") {
        return { type: "tool_use", id: p.id, name: p.name, input: p.input as object };
      }
      return { type: "text", text: "" };
    }),
  };
}

function mapStopReason(reason: string): AIStopReason {
  switch (reason) {
    case "end_turn":
      return "end_turn";
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    case "refusal":
      return "refusal";
    case "pause_turn":
      return "pause_turn";
    default:
      return "other";
  }
}
