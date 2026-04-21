import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../ink/Sidebar";
import { TweaksPanel } from "../ink/TweaksPanel";
import {
  ThemeContext,
  TweaksContext,
  buildTheme,
  loadTweaks,
  saveTweaks,
  type InkTweaks,
} from "../ink/theme";
import { usePayments } from "../hooks/useTransactions";
import { useSignals } from "../hooks/useSignals";
import { useCredits } from "../hooks/useCredits";
import { useHealth } from "../hooks/useHealth";
import { Onboarding } from "../pages/Onboarding";

export function Layout() {
  const [tweaks, setTweaks] = useState<InkTweaks>(() => loadTweaks());
  const theme = useMemo(() => buildTheme(tweaks), [tweaks]);
  const health = useHealth();

  useEffect(() => {
    saveTweaks(tweaks);
  }, [tweaks]);

  return (
    <TweaksContext.Provider value={{ tweaks, setTweaks }}>
      <ThemeContext.Provider value={theme}>
        {health.state === "loading" ? (
          <LoadingSplash />
        ) : health.state === "unconfigured" ? (
          <>
            <Onboarding />
            <TweaksPanel />
          </>
        ) : (
          <ConfiguredShell />
        )}
      </ThemeContext.Provider>
    </TweaksContext.Provider>
  );
}

/**
 * Split out so the InstantDB-backed hooks only fire once the service
 * reports a configured state. Rendering Sidebar (and therefore
 * usePayments etc.) against an unconfigured InstantDB app would trigger
 * fruitless queries with bad credentials.
 */
function ConfiguredShell() {
  const { payments } = usePayments();
  const signals = useSignals();
  const { credits } = useCredits();
  return (
    <>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
        }}
      >
        <Sidebar
          txCount={payments.length}
          incomeCount={credits.length}
          signalsCount={signals.activeCount || undefined}
        />
        <main
          style={{
            flex: 1,
            padding: "28px 36px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Outlet />
        </main>
      </div>
      <TweaksPanel />
    </>
  );
}

function LoadingSplash() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(242,242,244,0.42)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      Loading…
    </div>
  );
}
