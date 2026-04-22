import { useEffect, useState } from "react";

export type HealthState = "loading" | "unconfigured" | "running" | "paused" | "error";

export interface HealthResponse {
  state: Exclude<HealthState, "loading">;
  message?: string;
  senders: string[];
  transactionCount: number;
  lastSync: string | null;
  running: boolean;
}

export interface Health {
  state: HealthState;
  data: HealthResponse | null;
  error: string | null;
  refresh: () => void;
}

/**
 * Polls /api/health on an interval so the dashboard shell can react to
 * the service transitioning from "unconfigured" to "running" after the
 * onboarding wizard completes. The polling interval is cheap — a single
 * loopback JSON read — and stops mattering the moment the user lands on
 * the dashboard, since nothing in the main UI depends on polling.
 */
export function useHealth(pollMs = 4000): Health {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error(`health responded ${res.status}`);
        const body = (await res.json()) as HealthResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    poll();
    const handle = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [pollMs, tick]);

  const state: HealthState = data ? data.state : error ? "error" : "loading";

  return {
    state,
    data,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
