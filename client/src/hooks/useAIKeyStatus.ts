// Tracks which provider keys are configured on the service. Source of
// truth is /api/ai/keys; we re-fetch on mount and on the `xarji-ai-keys
// -changed` event the save/delete helpers dispatch.

import { useEffect, useState } from "react";
import { fetchKeyStatus, onKeyStatusChange, type AIKeyStatus } from "../lib/aiConfig";

export function useAIKeyStatus(): { status: AIKeyStatus; isLoading: boolean; refresh: () => void } {
  const [status, setStatus] = useState<AIKeyStatus>({ anthropic: false, openai: false });
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchKeyStatus().then((next) => {
      if (cancelled) return;
      setStatus(next);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => onKeyStatusChange(() => setVersion((v) => v + 1)), []);

  return { status, isLoading, refresh: () => setVersion((v) => v + 1) };
}
