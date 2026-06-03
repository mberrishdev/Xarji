import { useEffect, useState } from "react";

interface RateEntry {
  rate: number;
}

interface RatesResponse {
  ok: boolean;
  rates: Record<string, RateEntry>;
}

interface NbgRates {
  convert: (amount: number, currency: string) => number | null;
  ready: boolean;
}

// Module-level cache so all hook instances share one fetch
let cachedRates: Record<string, RateEntry> | null = null;
let fetchPromise: Promise<void> | null = null;

async function loadRates() {
  try {
    const res = await fetch("/api/exchange-rate");
    if (!res.ok) return;
    const data: RatesResponse = await res.json();
    if (data.ok) cachedRates = data.rates;
  } catch {
    // NBG unreachable — stay null, TxRow renders without GEL equiv
  }
}

export function useNbgRates(): NbgRates {
  const [ready, setReady] = useState(cachedRates !== null);

  useEffect(() => {
    if (cachedRates !== null) return;
    if (!fetchPromise) fetchPromise = loadRates();
    fetchPromise.then(() => setReady(true));
  }, []);

  return {
    ready,
    convert: (amount: number, currency: string) => {
      if (!cachedRates || currency === "GEL") return null;
      const entry = cachedRates[currency];
      if (!entry) return null;
      return amount * entry.rate;
    },
  };
}
