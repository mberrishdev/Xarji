import { useState } from "react";
import { useTheme, type InkTheme } from "../ink/theme";
import { Card, CardLabel } from "../ink/primitives";
import { CategoryPicker } from "./CategoryPicker";
import { type InkTx } from "../ink/TxRow";
import { useTransactionExclude, useTransactionDelete } from "../hooks/useTransactions";
import { useCategorizer } from "../hooks/useCategorizer";
import { currencySymbol } from "../ink/format";

export function TxDetailPanel({
  t,
  onClose,
  onDeleted,
}: {
  t: InkTx;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const T = useTheme();
  const setExcluded = useTransactionExclude();
  const deleteTx = useTransactionDelete();

  return (
    <Card
      pad="22px 24px"
      style={{ display: "flex", flexDirection: "column", position: "sticky", top: 28, alignSelf: "start", maxHeight: "calc(100vh - 56px)", overflowY: "auto" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <CardLabel>{t.kind === "failed" ? "Declined payment" : "Payment"}</CardLabel>
        <button
          onClick={onClose}
          style={{ border: "none", background: "transparent", color: T.dim, cursor: "pointer", fontSize: 16 }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: T.sans, letterSpacing: -0.8 }}>
        {t.merchant || "—"}
      </div>
      {t.rawMerchant && (
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 4 }}>{t.rawMerchant}</div>
      )}
      <div
        style={{
          marginTop: 18,
          fontSize: 44,
          fontWeight: 800,
          color: t.kind === "failed" ? T.accent : T.text,
          fontFamily: T.sans,
          letterSpacing: -1.6,
          lineHeight: 1,
        }}
      >
        {t.kind === "failed"
          ? "—"
          : `${currencySymbol(t.currency)}${(t.amount ?? 0).toFixed(2)}`}
      </div>
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <DetailRow
          T={T}
          k="When"
          v={new Date(t.transactionDate).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        />
        <DetailRow T={T} k="Card" v={t.cardLastDigits ? `··${t.cardLastDigits}` : "—"} />
        <DetailRow T={T} k="Bank" v={t.bankSenderId} />
        <CategoryDetailRow
          T={T}
          merchant={t.merchant}
          rawMerchant={t.rawMerchant}
          paymentId={t.kind === "payment" ? t.id : undefined}
        />
        {t.kind === "failed" ? (
          <DetailRow T={T} k="Reason" v={t.failureReason || "—"} />
        ) : (
          <DetailRow T={T} k="Points" v={t.plusEarned ? `+${t.plusEarned}` : "—"} />
        )}
        {t.kind !== "failed" && (
          <ExcludeToggleRow
            T={T}
            excluded={!!t.excludedFromAnalytics}
            onToggle={async (next) => {
              await setExcluded(t.kind === "credit" ? "credit" : "payment", t.id, next);
            }}
          />
        )}
        {t.kind !== "failed" && t.transactionId && (
          <DeleteRow
            T={T}
            onDelete={async () => {
              const dateStr = new Date(t.transactionDate).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const amountStr = t.amount != null ? `${currencySymbol(t.currency)}${t.amount.toFixed(2)}` : "—";
              const merchant = t.merchant || t.counterparty || "Unknown";
              if (
                !window.confirm(
                  `Delete this transaction?\n\n${merchant} · ${amountStr} · ${dateStr}\n\nIt will be removed from InstantDB and tombstoned so the next SMS sync won't re-import it. This cannot be undone.`
                )
              ) {
                return;
              }
              await deleteTx(t.kind === "credit" ? "credit" : "payment", t.id, t.transactionId!);
              onDeleted?.();
            }}
          />
        )}
      </div>
      <div style={{ marginTop: 18 }}>
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
          {t.rawMessage || "—"}
        </div>
      </div>
    </Card>
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

function DeleteRow({ T, onDelete }: { T: InkTheme; onDelete: () => Promise<void> }) {
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
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

function CategoryDetailRow({
  T,
  merchant,
  rawMerchant,
  paymentId,
}: {
  T: InkTheme;
  merchant: string | undefined;
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
          title={canEdit ? "Change category for this transaction" : "Merchant unknown"}
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
