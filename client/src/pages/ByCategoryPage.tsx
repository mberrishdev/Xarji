import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "../ink/theme";
import { Card, PageHeader } from "../ink/primitives";
import { TxRow, type InkTx } from "../ink/TxRow";
import { useConvertedPayments } from "../hooks/useTransactions";
import { useCategorizer } from "../hooks/useCategorizer";
import { useRangeState } from "../hooks/useRangeState";
import { isInRange } from "../lib/dateRange";
import { formatGEL } from "../ink/format";
import type { InkCategory } from "../lib/utils";

interface CatAgg {
  cat: string;
  total: number;
  count: number;
  meta: InkCategory;
}

export function ByCategoryPage() {
  const T = useTheme();
  const { payments } = useConvertedPayments();
  const { range, props: rangeProps } = useRangeState("Month");
  const { categorize, getCategory } = useCategorizer();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const monthPayments = useMemo(
    () =>
      payments.filter(
        (p) => !p.excludedFromAnalytics && p.gelAmount !== null && isInRange(p.transactionDate, range)
      ),
    [payments, range]
  );

  useEffect(() => {
    setOpenIds(new Set());
  }, [range]);

  const cats: CatAgg[] = useMemo(() => {
    const map: Record<string, CatAgg> = {};
    for (const p of monthPayments) {
      if (p.gelAmount === null) continue;
      const cat = getCategory(p.merchant, p.rawMessage, p.id);
      if (!map[cat.id]) map[cat.id] = { cat: cat.id, total: 0, count: 0, meta: cat };
      map[cat.id].total += p.gelAmount;
      map[cat.id].count += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthPayments, getCategory]);

  const txsByCat = useMemo(() => {
    const map: Record<string, InkTx[]> = {};
    for (const p of monthPayments) {
      const catId = categorize(p.merchant, p.rawMessage, p.id);
      if (!map[catId]) map[catId] = [];
      map[catId].push({
        id: p.id,
        kind: "payment" as const,
        merchant: p.merchant || "",
        rawMerchant: p.rawMessage,
        amount: p.amount,
        currency: p.currency,
        cardLastDigits: p.cardLastDigits,
        transactionDate: p.transactionDate,
        bankSenderId: p.bankSenderId,
        category: catId,
        rawMessage: p.rawMessage,
        excludedFromAnalytics: p.excludedFromAnalytics,
      });
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.transactionDate - a.transactionDate);
    }
    return map;
  }, [monthPayments, categorize]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.density.gap }}>
      <PageHeader eyebrow="Transactions · by category" title="By Category" {...rangeProps} />
      {cats.length === 0 ? (
        <Card>
          <div
            style={{
              color: T.muted,
              fontSize: 13,
              padding: "48px 0",
              textAlign: "center",
              fontFamily: T.sans,
            }}
          >
            No transactions in this range.
          </div>
        </Card>
      ) : (
        <Card pad="0">
          <div style={{ overflowY: "auto" }}>
            {cats.map((c, idx) => {
              const isOpen = openIds.has(c.cat);
              const isLastCat = idx === cats.length - 1;
              const txs = txsByCat[c.cat] ?? [];
              return (
                <div key={c.cat}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(c.cat)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggle(c.cat);
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = T.panelAlt;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 24px",
                      cursor: "pointer",
                      borderBottom: !isLastCat || isOpen ? `1px solid ${T.line}` : "none",
                      userSelect: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: c.meta.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 14,
                        color: T.muted,
                        flexShrink: 0,
                      }}
                    >
                      {c.meta.icon}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: T.text,
                        fontFamily: T.sans,
                      }}
                    >
                      {c.meta.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.dim,
                        fontFamily: T.mono,
                        marginRight: 12,
                      }}
                    >
                      {c.count} tx
                    </span>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        fontFamily: T.sans,
                        fontVariantNumeric: "tabular-nums",
                        color: T.text,
                        marginRight: 8,
                      }}
                    >
                      {formatGEL(c.total, { decimals: 0 })}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 0 : -90 }}
                      transition={{ duration: 0.15 }}
                      style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, display: "inline-block" }}
                    >
                      ▾
                    </motion.span>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key={c.cat}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ paddingBottom: 8 }}>
                          {txs.map((t, i) => (
                            <TxRow key={t.id} t={t} isLast={i === txs.length - 1} compact />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
