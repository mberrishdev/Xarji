import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme, useViewport } from "../ink/theme";
import { Card, CardLabel, PageHeader } from "../ink/primitives";
import { TxRow, type InkTx } from "../ink/TxRow";
import { CategoryPicker } from "../components/CategoryPicker";
import { useConvertedPayments, useFailedPayments, useTransactionDelete, useTransactionExclude, useSplitTransaction, usePaymentAmountEdit, usePaymentMerchantEdit } from "../hooks/useTransactions";
import type { ConvertedPayment } from "../hooks/useTransactions";
import { useBankSenders } from "../hooks/useBankSenders";
import { useRangeState } from "../hooks/useRangeState";
import { isInRange, isValidIsoDateRange } from "../lib/dateRange";
import { useCategorizer } from "../hooks/useCategorizer";
import { currencySymbol, formatLocalDay, parseLocalDay } from "../ink/format";
import type { InkTheme } from "../ink/theme";

type TxKind = "all" | "payment" | "failed";
type TxAnalytics = "all" | "included" | "excluded";

export function Transactions() {
  const T = useTheme();
  const vp = useViewport();
  const { payments } = useConvertedPayments();
  const { failedPayments } = useFailedPayments();
  const setExcluded = useTransactionExclude();
  const deleteTx = useTransactionDelete();
  const editAmount = usePaymentAmountEdit();
  const editMerchant = usePaymentMerchantEdit();
  const { senders } = useBankSenders();
  const { categorize: categorizeId, allCategories } = useCategorizer();
  // Drill-down search params accepted on first paint. Anything that doesn't
  // match falls through to the unfiltered default — chart drill-downs can
  // freely add params without breaking the page if a future link mistypes
  // a key.
  //   ?category=<id>          — pre-select category filter
  //   ?merchant=<text>        — pre-fill the search box (substring match)
  //   ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
  //                           — switch range to "Custom" with these dates
  const [searchParams] = useSearchParams();
  const initialCat = (() => {
    const raw = searchParams.get("category");
    if (!raw) return "all";
    return allCategories.some((c) => c.id === raw) ? raw : "all";
  })();
  const initialMerchant = searchParams.get("merchant") || "";
  const initialCustom = (() => {
    const start = searchParams.get("dateFrom") || "";
    const end = searchParams.get("dateTo") || "";
    const candidate = { start, end };
    return isValidIsoDateRange(candidate) ? candidate : undefined;
  })();

  const { range, props: rangeProps } = useRangeState("Month", { customInitial: initialCustom });

  const [search, setSearch] = useState(initialMerchant);
  const [bank, setBank] = useState("all");
  const [cat, setCat] = useState(initialCat);
  const [kind, setKind] = useState<TxKind>("all");
  const [analytics, setAnalytics] = useState<TxAnalytics>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [editAmountMode, setEditAmountMode] = useState(false);
  const [editTitleMode, setEditTitleMode] = useState(false);

  const allTx: InkTx[] = useMemo(() => {
    const combined: InkTx[] = [
      ...payments.map((p) => ({
        id: p.id,
        transactionId: p.transactionId,
        kind: "payment" as const,
        merchant: p.merchant || "",
        rawMerchant: p.rawMessage,
        amount: p.amount,
        currency: p.currency,
        cardLastDigits: p.cardLastDigits,
        transactionDate: p.transactionDate,
        bankSenderId: p.bankSenderId,
        category: categorizeId(p.merchant, p.rawMessage, p.id),
        rawMessage: p.rawMessage,
        plusEarned: p.plusEarned,
        excludedFromAnalytics: p.excludedFromAnalytics,
        splitFrom: p.splitFrom,
      })),
      ...failedPayments.map((f) => ({
        id: f.id,
        transactionId: f.transactionId,
        kind: "failed" as const,
        merchant: f.merchant || "",
        rawMerchant: f.rawMessage,
        amount: null,
        currency: f.currency,
        cardLastDigits: f.cardLastDigits,
        transactionDate: f.transactionDate,
        bankSenderId: f.bankSenderId,
        category: categorizeId(f.merchant, f.rawMessage),
        rawMessage: f.rawMessage,
        failureReason: f.failureReason,
      })),
    ];
    return combined.sort((a, b) => b.transactionDate - a.transactionDate);
  }, [payments, failedPayments, categorizeId]);

  const filtered = useMemo(() => {
    return allTx.filter((t) => {
      if (!isInRange(t.transactionDate, range)) return false;
      if (bank !== "all" && t.bankSenderId !== bank) return false;
      if (cat !== "all" && t.category !== cat) return false;
      if (kind !== "all" && t.kind !== kind) return false;
      if (analytics === "excluded" && !t.excludedFromAnalytics) return false;
      if (analytics === "included" && t.excludedFromAnalytics) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.merchant.toLowerCase().includes(q) && !(t.rawMessage || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allTx, bank, cat, kind, search, range]);

  const groups = useMemo(() => {
    const g: Record<string, InkTx[]> = {};
    for (const t of filtered.slice(0, 200)) {
      const key = formatLocalDay(t.transactionDate);
      if (!g[key]) g[key] = [];
      g[key].push(t);
    }
    return g;
  }, [filtered]);

  const dayKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  // Resolve the side panel from `filtered`, not `allTx`. If the active
  // filters no longer contain the selection, drop it so the panel doesn't
  // contradict the visible list.
  const selected = selectedId ? filtered.find((t) => t.id === selectedId) : null;
  useEffect(() => {
    if (selectedId && !filtered.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  useEffect(() => { setSplitMode(false); setEditAmountMode(false); setEditTitleMode(false); }, [selectedId]);

  const selectedPayment = selected ? payments.find((p) => p.id === selected.id) ?? null : null;

  const bankOptions = senders.length > 0
    ? senders.map((s) => ({ id: s.senderId, name: s.displayName }))
    : Array.from(new Set(allTx.map((t) => t.bankSenderId)).values()).map((id) => ({ id, name: id }));

  const FilterPill = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      style={{
        padding: "7px 13px",
        borderRadius: 999,
        border: `1px solid ${active ? T.accent : T.line}`,
        background: active ? T.accentSoft : "transparent",
        color: active ? T.accent : T.muted,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: T.sans,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.density.gap, height: "100%" }}>
      <PageHeader
        eyebrow="All transactions · read-only from SMS"
        title="Transactions"
        {...rangeProps}
        rightSlot={
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>
            {filtered.length.toLocaleString("en-US")} results
          </span>
        }
      />

      <Card pad="16px 18px">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              flex: "1 1 260px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: T.panelAlt,
              borderRadius: 10,
              border: `1px solid ${T.line}`,
            }}
          >
            <span style={{ fontFamily: T.mono, color: T.dim }}>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant or raw SMS…"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: T.text,
                fontSize: 13,
                outline: "none",
                fontFamily: T.sans,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ border: "none", background: "transparent", color: T.dim, cursor: "pointer", fontSize: 14 }}
              >
                ×
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <FilterPill active={kind === "all"} onClick={() => setKind("all")}>All</FilterPill>
            <FilterPill active={kind === "payment"} onClick={() => setKind("payment")}>Successful</FilterPill>
            <FilterPill active={kind === "failed"} onClick={() => setKind("failed")}>Declined</FilterPill>
          </div>
          <div style={{ width: 1, height: 20, background: T.line }} />
          <div style={{ display: "flex", gap: 6 }}>
            <FilterPill active={analytics === "all"} onClick={() => setAnalytics("all")}>All</FilterPill>
            <FilterPill active={analytics === "included"} onClick={() => setAnalytics("included")}>Included</FilterPill>
            <FilterPill active={analytics === "excluded"} onClick={() => setAnalytics("excluded")}>Excluded</FilterPill>
          </div>
          <div style={{ width: 1, height: 20, background: T.line }} />
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            style={{
              padding: "7px 12px",
              background: T.panelAlt,
              border: `1px solid ${T.line}`,
              color: T.text,
              borderRadius: 10,
              fontSize: 12,
              fontFamily: T.sans,
              cursor: "pointer",
            }}
          >
            <option value="all">All banks</option>
            {bankOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.name}
              </option>
            ))}
          </select>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            style={{
              padding: "7px 12px",
              background: T.panelAlt,
              border: `1px solid ${T.line}`,
              color: T.text,
              borderRadius: 10,
              fontSize: 12,
              fontFamily: T.sans,
              cursor: "pointer",
            }}
          >
            <option value="all">All categories</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: selected ? (vp.narrow ? "1fr" : "1fr 340px") : "1fr",
          gap: T.density.gap,
          flex: 1,
          minHeight: 0,
        }}
      >
        <Card pad="8px 24px 16px" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>
            {dayKeys.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 12, padding: "40px 0", textAlign: "center" }}>
                No transactions match the filters.
              </div>
            ) : (
              dayKeys.map((key) => {
                const items = groups[key];
                const d = parseLocalDay(key);
                // Day-header total sums every successful payment as a GEL
                // equivalent (NBG rate for the row's date). Declines are
                // skipped — they have no amount. Rows still waiting on a
                // rate (gelAmount === null) are also skipped this render
                // and snap into the total once the fetch resolves.
                // User-excluded rows skip the total too — their amount
                // shouldn't bump the day's spend even though they
                // remain visible in the list.
                const successItems = items.filter((t) => t.kind === "payment");
                const total = successItems.reduce((s, t) => {
                  const p = payments.find((pp) => pp.id === t.id);
                  if (p?.excludedFromAnalytics) return s;
                  return s + (p?.gelAmount ?? 0);
                }, 0);
                const hasGelActivity = total > 0;
                const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
                const label =
                  diff === 0
                    ? "Today"
                    : diff === 1
                    ? "Yesterday"
                    : d.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric" });
                return (
                  <div key={key}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        padding: "14px 0 8px",
                        borderBottom: `1px solid ${T.line}`,
                        position: "sticky",
                        top: 0,
                        background: T.panel,
                        zIndex: 1,
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0, flexShrink: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.sans, whiteSpace: "nowrap" }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
                          {items.length} tx
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          color: T.muted,
                          fontFamily: T.mono,
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {hasGelActivity ? `−₾${total.toFixed(2)} GEL` : "—"}
                      </span>
                    </div>
                    {items.map((t, i) => (
                      <TxRow key={t.id} t={t} isLast={i === items.length - 1} selected={t.id === selectedId} onClick={() => setSelectedId(t.id === selectedId ? null : t.id)} />
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {selected && (
          <Card pad="22px 24px" style={{ display: "flex", flexDirection: "column", position: "sticky", top: 28, alignSelf: "start", maxHeight: "calc(100vh - 56px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <CardLabel>{splitMode ? "Split transaction" : selected.kind === "failed" ? "Declined payment" : "Payment"}</CardLabel>
              <button
                onClick={() => splitMode ? setSplitMode(false) : setSelectedId(null)}
                style={{ border: "none", background: "transparent", color: T.dim, cursor: "pointer", fontSize: 16 }}
              >
                ×
              </button>
            </div>

            {splitMode && selectedPayment ? (
              <SplitPanel
                T={T}
                selected={selected}
                originalPayment={selectedPayment}
                onSave={() => { setSplitMode(false); setSelectedId(null); }}
                onCancel={() => setSplitMode(false)}
              />
            ) : (
              <>
                {editTitleMode ? (
                  <EditTitlePanel
                    T={T}
                    selected={selected}
                    onSave={async (name) => { await editMerchant(selected.id, name); setEditTitleMode(false); }}
                    onCancel={() => setEditTitleMode(false)}
                  />
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: T.sans, letterSpacing: -0.8 }}>
                        {selected.merchant || "—"}
                      </span>
                      {selected.kind === "payment" && (
                        <button
                          onClick={() => setEditTitleMode(true)}
                          title="Edit merchant name"
                          style={{
                            border: `1px solid ${T.line}`,
                            background: "transparent",
                            color: T.dim,
                            borderRadius: 6,
                            padding: "2px 7px",
                            cursor: "pointer",
                            fontSize: 11,
                            fontFamily: T.sans,
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {selected.rawMerchant && (
                      <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 4 }}>{selected.rawMerchant}</div>
                    )}
                  </>
                )}
                {editAmountMode ? (
                  <EditAmountPanel
                    T={T}
                    selected={selected}
                    onSave={async (n) => { await editAmount(selected.id, n); setEditAmountMode(false); }}
                    onCancel={() => setEditAmountMode(false)}
                  />
                ) : (
                  <>
                    <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 44,
                          fontWeight: 800,
                          color: selected.kind === "failed" ? T.accent : T.text,
                          fontFamily: T.sans,
                          letterSpacing: -1.6,
                          lineHeight: 1,
                        }}
                      >
                        {selected.kind === "failed"
                          ? "—"
                          : `${currencySymbol(selected.currency)}${(selected.amount ?? 0).toFixed(2)}`}
                      </span>
                      {selected.kind === "payment" && (
                        <button
                          onClick={() => setEditAmountMode(true)}
                          title="Edit amount"
                          style={{
                            border: `1px solid ${T.line}`,
                            background: "transparent",
                            color: T.dim,
                            borderRadius: 6,
                            padding: "3px 8px",
                            cursor: "pointer",
                            fontSize: 11,
                            fontFamily: T.sans,
                            marginBottom: 4,
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                      <DetailRow T={T} k="When" v={new Date(selected.transactionDate).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} />
                      <DetailRow T={T} k="Card" v={selected.cardLastDigits ? `··${selected.cardLastDigits}` : "—"} />
                      <DetailRow T={T} k="Bank" v={selected.bankSenderId} />
                      <CategoryDetailRow T={T} merchant={selected.merchant} rawMerchant={selected.rawMerchant} paymentId={selected.kind === "payment" ? selected.id : undefined} />
                      {selected.kind === "failed" ? (
                        <DetailRow T={T} k="Reason" v={selected.failureReason || "—"} />
                      ) : (
                        <DetailRow T={T} k="Points" v={selected.plusEarned ? `+${selected.plusEarned}` : "—"} />
                      )}
                      {selected.kind !== "failed" && (
                        <ExcludeToggleRow
                          T={T}
                          excluded={!!selected.excludedFromAnalytics}
                          onToggle={async (next) => {
                            await setExcluded(
                              selected.kind === "credit" ? "credit" : "payment",
                              selected.id,
                              next
                            );
                          }}
                        />
                      )}
                      {selected.kind === "payment" && selected.amount != null && !selected.splitFrom && (
                        <SplitRow T={T} onSplit={() => setSplitMode(true)} />
                      )}
                      {selected.kind !== "failed" && selected.transactionId && (
                        <DeleteRow
                          T={T}
                          onDelete={async () => {
                            const dateStr = new Date(selected.transactionDate).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                            const amountStr = selected.amount != null
                              ? `${currencySymbol(selected.currency)}${selected.amount.toFixed(2)}`
                              : "—";
                            const merchant = selected.merchant || selected.counterparty || "Unknown";
                            if (
                              !window.confirm(
                                `Delete this transaction?\n\n${merchant} · ${amountStr} · ${dateStr}\n\nIt will be removed from InstantDB and tombstoned so the next SMS sync won't re-import it. This cannot be undone.`
                              )
                            ) {
                              return;
                            }
                            await deleteTx(
                              selected.kind === "credit" ? "credit" : "payment",
                              selected.id,
                              selected.transactionId!
                            );
                            setSelectedId(null);
                          }}
                        />
                      )}
                    </div>
                  </>
                )}
                {!editAmountMode && <div style={{ marginTop: 18 }}>
                  <CardLabel>Raw SMS</CardLabel>
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: T.panelAlt,
                      borderRadius: T.rMd,
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.muted,
                      lineHeight: 1.5,
                      border: `1px solid ${T.line}`,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {selected.rawMessage || "—"}
                  </div>
                </div>}
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailRow({ T, k, v }: { T: InkTheme; k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 12, color: T.muted, fontFamily: T.sans }}>{k}</span>
      <span style={{ fontSize: 12.5, color: T.text, fontFamily: T.sans, fontWeight: 600 }}>{v}</span>
    </div>
  );
}

/**
 * Detail-panel toggle that flips a transaction's `excludedFromAnalytics`
 * flag. The row stays visible in the /transactions ledger either way;
 * the flag only affects whether it counts in totals / donut / trend /
 * signals. Wires through useTransactionExclude (shared with the AI
 * tools) so the InstantDB write happens in one place.
 */
function ExcludeToggleRow({
  T,
  excluded,
  onToggle,
}: {
  T: InkTheme;
  excluded: boolean;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onToggle(!excluded);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 12, color: T.muted, fontFamily: T.sans }}>In analytics</span>
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        title={excluded ? "Include this transaction in analytics" : "Exclude this transaction from analytics"}
        style={{
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${T.line}`,
          background: excluded ? T.panelAlt : "transparent",
          color: excluded ? T.dim : T.text,
          fontSize: 11.5,
          fontWeight: 600,
          fontFamily: T.sans,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {excluded ? "Excluded · re-include" : "Included · exclude"}
      </button>
    </div>
  );
}

/**
 * Permanent-delete affordance in the detail panel. Sits below the
 * Exclude toggle and rendered in destructive accent so the user can't
 * confuse it with the soft-toggle. Goes through useTransactionDelete
 * which calls the bun service so the tombstone is recorded — without
 * that, the next SMS sync would re-import the row.
 */
function DeleteRow({
  T,
  onDelete,
}: {
  T: InkTheme;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <span style={{ fontSize: 12, color: T.muted, fontFamily: T.sans }}>Permanent</span>
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        title="Remove this transaction from InstantDB and tombstone it so SMS resyncs don't re-import it"
        style={{
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${T.accent}55`,
          background: "transparent",
          color: T.accent,
          fontSize: 11.5,
          fontWeight: 600,
          fontFamily: T.sans,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}

function EditTitlePanel({
  T,
  selected,
  onSave,
  onCancel,
}: {
  T: InkTheme;
  selected: InkTx;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(selected.merchant);
  const [busy, setBusy] = useState(false);
  const valid = value.trim().length > 0;

  const handleSave = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { await onSave(value.trim()); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: T.panelAlt,
          border: `1px solid ${T.accent}`,
          borderRadius: T.rMd,
          color: T.text,
          fontSize: 20,
          fontWeight: 700,
          fontFamily: T.sans,
          letterSpacing: -0.5,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "7px", border: `1px solid ${T.line}`,
            borderRadius: T.rMd, background: "transparent",
            color: T.muted, cursor: "pointer", fontSize: 12, fontFamily: T.sans,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!valid || busy}
          style={{
            flex: 1, padding: "7px", border: "none",
            borderRadius: T.rMd,
            background: valid && !busy ? T.accent : T.panelAlt,
            color: valid && !busy ? "#fff" : T.dim,
            cursor: valid && !busy ? "pointer" : "not-allowed",
            fontSize: 12, fontWeight: 600, fontFamily: T.sans,
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function EditAmountPanel({
  T,
  selected,
  onSave,
  onCancel,
}: {
  T: InkTheme;
  selected: InkTx;
  onSave: (amount: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState((selected.amount ?? 0).toFixed(2));
  const [busy, setBusy] = useState(false);
  const sym = currencySymbol(selected.currency);
  const parsed = parseFloat(value);
  const valid = !isNaN(parsed) && parsed > 0;

  const handleSave = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { await onSave(parsed); } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: T.muted, fontFamily: T.sans }}>
        Edit amount · {selected.merchant || "—"}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: T.panelAlt,
          border: `1px solid ${T.accent}`,
          borderRadius: T.rMd,
        }}
      >
        <span style={{ fontFamily: T.mono, color: T.dim, fontSize: 22, flexShrink: 0 }}>{sym}</span>
        <input
          autoFocus
          type="number"
          min="0.01"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onCancel();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            background: "transparent",
            color: T.text,
            fontSize: 36,
            fontWeight: 800,
            fontFamily: T.sans,
            letterSpacing: -1,
            outline: "none",
            fontVariantNumeric: "tabular-nums",
            width: "100%",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "9px", border: `1px solid ${T.line}`,
            borderRadius: T.rMd, background: "transparent",
            color: T.muted, cursor: "pointer", fontSize: 13, fontFamily: T.sans,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!valid || busy}
          style={{
            flex: 1, padding: "9px", border: "none",
            borderRadius: T.rMd,
            background: valid && !busy ? T.accent : T.panelAlt,
            color: valid && !busy ? "#fff" : T.dim,
            cursor: valid && !busy ? "pointer" : "not-allowed",
            fontSize: 13, fontWeight: 600, fontFamily: T.sans,
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function SplitRow({ T, onSplit }: { T: InkTheme; onSplit: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 12, color: T.muted, fontFamily: T.sans }}>Split</span>
      <button
        type="button"
        onClick={onSplit}
        style={{
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${T.line}`,
          background: "transparent",
          color: T.text,
          fontSize: 11.5,
          fontWeight: 600,
          fontFamily: T.sans,
          cursor: "pointer",
        }}
      >
        Split transaction
      </button>
    </div>
  );
}

function SplitPanel({
  T,
  selected,
  originalPayment,
  onSave,
  onCancel,
}: {
  T: InkTheme;
  selected: InkTx;
  originalPayment: ConvertedPayment;
  onSave: () => void;
  onCancel: () => void;
}) {
  const splitTx = useSplitTransaction();
  const total = selected.amount!;
  const sym = currencySymbol(selected.currency);

  const [segments, setSegments] = useState([
    { amount: "", merchant: selected.merchant },
    { amount: "", merchant: selected.merchant },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualSum = segments.slice(0, -1).reduce((s, seg) => {
    const n = parseFloat(seg.amount);
    return s + (isNaN(n) ? 0 : n);
  }, 0);
  const lastAmount = Math.round((total - manualSum) * 100) / 100;

  const effectiveAmounts = segments.map((seg, i) =>
    i === segments.length - 1 ? lastAmount : Math.round((parseFloat(seg.amount) || 0) * 100) / 100
  );
  const isValid = lastAmount > 0 && effectiveAmounts.every((a) => a > 0);

  const firstInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!isValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await splitTx(originalPayment, effectiveAmounts.map((amount, i) => ({ amount, merchant: segments[i].merchant })));
      onSave();
    } catch {
      setError("Split failed. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13, color: T.muted, fontFamily: T.sans }}>
        {selected.merchant} · {sym}{total.toFixed(2)} {selected.currency}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          return (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  marginTop: 9,
                  borderRadius: 10,
                  background: T.panelAlt,
                  border: `1px solid ${T.line}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.dim,
                  flexShrink: 0,
                }}
              >
                {String.fromCharCode(65 + idx)}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <input
                  value={seg.merchant}
                  onChange={(e) =>
                    setSegments((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, merchant: e.target.value } : s))
                    )
                  }
                  placeholder="Merchant name"
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    background: T.panelAlt,
                    border: `1px solid ${T.line}`,
                    borderRadius: T.rMd,
                    color: T.text,
                    fontSize: 13,
                    fontFamily: T.sans,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 10px",
                    background: T.panelAlt,
                    borderRadius: T.rMd,
                    border: `1px solid ${T.line}`,
                  }}
                >
                  <span style={{ fontFamily: T.mono, color: T.dim, fontSize: 13 }}>{sym}</span>
                  {isLast ? (
                    <span
                      style={{
                        flex: 1,
                        fontFamily: T.mono,
                        fontSize: 13,
                        fontVariantNumeric: "tabular-nums",
                        color: lastAmount > 0 ? T.text : T.accent,
                      }}
                    >
                      {lastAmount.toFixed(2)}
                      <span style={{ fontSize: 10, color: T.dim, marginLeft: 8 }}>auto</span>
                    </span>
                  ) : (
                    <input
                      ref={idx === 0 ? firstInputRef : undefined}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={seg.amount}
                      onChange={(e) =>
                        setSegments((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, amount: e.target.value } : s))
                        )
                      }
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                      placeholder="0.00"
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        color: T.text,
                        fontSize: 13,
                        outline: "none",
                        fontFamily: T.mono,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  )}
                </div>
              </div>
              {segments.length > 2 && (
                <button
                  onClick={() => setSegments((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ border: "none", background: "transparent", color: T.dim, cursor: "pointer", fontSize: 16, padding: "0 2px", marginTop: 8, lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {lastAmount < 0 && (
        <div style={{ fontSize: 12, color: T.accent, fontFamily: T.sans }}>
          Over by {sym}{Math.abs(lastAmount).toFixed(2)} — reduce the amounts above.
        </div>
      )}

      {segments.length < 6 && (
        <button
          onClick={() => setSegments((prev) => [...prev, { amount: "", merchant: selected.merchant }])}
          style={{
            border: `1px dashed ${T.line}`,
            background: "transparent",
            color: T.muted,
            borderRadius: T.rMd,
            padding: "7px",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: T.sans,
          }}
        >
          + Add segment
        </button>
      )}

      {error && <div style={{ fontSize: 12, color: T.accent, fontFamily: T.sans }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "9px",
            border: `1px solid ${T.line}`,
            borderRadius: T.rMd,
            background: "transparent",
            color: T.muted,
            cursor: "pointer",
            fontSize: 13,
            fontFamily: T.sans,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid || busy}
          style={{
            flex: 1,
            padding: "9px",
            border: "none",
            borderRadius: T.rMd,
            background: isValid && !busy ? T.accent : T.panelAlt,
            color: isValid && !busy ? "#fff" : T.dim,
            cursor: isValid && !busy ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: T.sans,
          }}
        >
          {busy ? "Splitting…" : "Save splits"}
        </button>
      </div>
    </div>
  );
}

/**
 * Special-cased detail-panel row for Category — clicking the value
 * opens the CategoryPicker anchored to this row, with a "+ Create new
 * category" inline option. Persists as a per-merchant override (same
 * model the inline picker uses on the row's category badge).
 */
function CategoryDetailRow({
  T,
  merchant,
  rawMerchant,
  paymentId,
}: {
  T: InkTheme;
  merchant: string;
  rawMerchant?: string;
  paymentId?: string;
}) {
  const { getCategory } = useCategorizer();
  const [open, setOpen] = useState(false);
  const cat = getCategory(merchant, rawMerchant, paymentId);
  const pickerMerchant = (merchant || rawMerchant || "").trim();
  const canEdit = pickerMerchant.length > 0;

  return (
    <div style={{ position: "relative", borderBottom: `1px solid ${T.line}`, paddingBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 0" }}>
        <span style={{ fontSize: 12, color: T.muted, fontFamily: T.sans }}>Category</span>
        <button
          type="button"
          onClick={() => canEdit && setOpen((o) => !o)}
          disabled={!canEdit}
          title={canEdit ? "Change category for all transactions from this merchant" : "Merchant unknown"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            background: open ? T.panelAlt : "transparent",
            color: T.text,
            fontFamily: T.sans,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: canEdit ? "pointer" : "not-allowed",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 4, background: cat.color }} />
          {cat.name}
          {canEdit && (
            <span style={{ fontSize: 9, color: T.dim, marginLeft: 4 }}>{open ? "▴" : "▾"}</span>
          )}
        </button>
      </div>
      {open && canEdit && (
        <CategoryPicker
          merchant={pickerMerchant}
          current={cat}
          onClose={() => setOpen(false)}
          anchor="right"
          paymentId={paymentId}
        />
      )}
    </div>
  );
}
