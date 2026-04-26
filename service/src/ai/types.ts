// Service-side mirror of the AI protocol the dashboard speaks.
// Wire format = JSON-encoded events streamed as SSE; this file defines
// the shapes both sides agree on.
//
// Keep these in sync with client/src/lib/ai/types.ts. Any addition
// requires updating both files (no shared package, on purpose — the
// service ships as a compiled binary and the client as a browser
// bundle, no good place for shared TS).

export type AIProviderId = "anthropic" | "openai";

export type AIContentPart =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolUseId: string; output: string; isError?: boolean };

export type AICoreMessage =
  | { role: "user"; content: string | AIContentPart[] }
  | { role: "assistant"; content: AIContentPart[] };

export interface AIToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type AIStreamEvent =
  | { kind: "text-delta"; text: string }
  | { kind: "tool-call"; id: string; name: string; input: unknown }
  | { kind: "stop"; reason: AIStopReason }
  | { kind: "error"; error: string };

export type AIStopReason =
  | "end_turn"
  | "tool_use"
  | "max_tokens"
  | "refusal"
  | "pause_turn"
  | "other";

export interface AIStreamRequest {
  provider: AIProviderId;
  model: string;
  systemPrompt: string;
  messages: AICoreMessage[];
  tools: AIToolDefinition[];
}

export interface AIProvider {
  id: AIProviderId;
  stream(opts: {
    apiKey: string;
    model: string;
    systemPrompt: string;
    messages: AICoreMessage[];
    tools: AIToolDefinition[];
    signal?: AbortSignal;
  }): AsyncIterable<AIStreamEvent>;
}
