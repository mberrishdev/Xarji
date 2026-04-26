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

  return (
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
  );
}
