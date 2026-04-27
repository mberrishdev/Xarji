import { useEffect, useMemo, useState } from "react";
import {
  AI_PROVIDERS,
  loadAIConfig,
  saveAIConfig,
  type AIConfig,
  type AIProviderId,
} from "../lib/aiConfig";
import { useAIKeyStatus } from "../hooks/useAIKeyStatus";
import { AssistantOnboarding } from "../components/AssistantOnboarding";
import { AssistantChat } from "../components/AssistantChat";

export function Assistant() {
  const { status, isLoading, refresh } = useAIKeyStatus();
  const [storedConfig, setStoredConfig] = useState<AIConfig | null>(loadAIConfig);

  // Treat the user as connected if any provider has a key on the
  // service. The local AIConfig (provider+model preference) snaps to
  // a provider that actually has a key when we have to choose one.
  const anyKeySet = status.anthropic || status.openai;

  const effectiveConfig = useMemo<AIConfig | null>(() => {
    if (!anyKeySet) return null;
    const preferred: AIProviderId | null =
      storedConfig?.provider && status[storedConfig.provider]
        ? storedConfig.provider
        : status.anthropic
          ? "anthropic"
          : status.openai
            ? "openai"
            : null;
    if (!preferred) return null;
    const provider = AI_PROVIDERS.find((p) => p.id === preferred)!;
    const model =
      storedConfig?.provider === preferred && storedConfig?.model
        ? storedConfig.model
        : provider.defaultModel;
    return { provider: preferred, model };
  }, [anyKeySet, status, storedConfig]);

  useEffect(() => {
    if (effectiveConfig && (effectiveConfig.provider !== storedConfig?.provider || effectiveConfig.model !== storedConfig?.model)) {
      saveAIConfig(effectiveConfig);
      setStoredConfig(effectiveConfig);
    }
  }, [effectiveConfig, storedConfig?.provider, storedConfig?.model]);

  if (isLoading) {
    return (
      <div style={{ padding: 40, color: "rgba(242,242,244,0.62)", fontFamily: "system-ui" }}>
        Loading…
      </div>
    );
  }

  if (!effectiveConfig) {
    return (
      <AssistantOnboarding
        onSaved={() => {
          refresh();
        }}
      />
    );
  }

  // The chat is the only page in the app whose content fits a viewport
  // exactly: the message scroller needs its own bounded height so it
  // overflows internally instead of pushing the input row off-screen.
  // Wrap it here (scoped to /assistant) so the global Layout shell
  // stays simple — every other page scrolls the document the way it
  // always did.
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        // 100vh minus the main padding (28px top + 28px bottom) so the
        // chat's input row stays anchored above the viewport bottom
        // instead of being pushed below by the surrounding shell.
        height: "calc(100vh - 56px)",
      }}
    >
      <AssistantChat
        config={effectiveConfig}
        onClear={() => {
          // Disconnect = clear the local provider/model preference. The
          // actual key lives on the service and is removed via
          // SettingsAISection / AssistantChat's "Disconnect" path.
          setStoredConfig(null);
          refresh();
        }}
      />
    </div>
  );
}
