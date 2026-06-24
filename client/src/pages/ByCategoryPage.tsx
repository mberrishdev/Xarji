import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTheme } from "../ink/theme";
import { PageHeader } from "../ink/primitives";
import { TxRow, type InkTx } from "../ink/TxRow";
import { TxDetailPanel } from "../components/TxDetailPanel";
import { useConvertedPayments } from "../hooks/useTransactions";
import { useCategorizer } from "../hooks/useCategorizer";
import { useCategories, useCategoryActions } from "../hooks/useCategories";
import { useRangeState } from "../hooks/useRangeState";
import { isInRange, previousRange, type DateRange } from "../lib/dateRange";
import { formatGEL } from "../ink/format";
import type { InkCategory } from "../lib/utils";

interface CatAgg {
  cat: string;
  total: number;
  count: number;
  meta: InkCategory;
}

// ── Grip icon (3×2 dot grid) ─────────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="7" height="14" viewBox="0 0 7 14" fill="currentColor">
      <circle cx="1.5" cy="2"  r="1.1" /><circle cx="5.5" cy="2"  r="1.1" />
      <circle cx="1.5" cy="7"  r="1.1" /><circle cx="5.5" cy="7"  r="1.1" />
      <circle cx="1.5" cy="12" r="1.1" /><circle cx="5.5" cy="12" r="1.1" />
    </svg>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ spent, budget, accent }: { spent: number; budget: number; accent: string }) {
  const pct = Math.round((spent / budget) * 100);
  const isOver = pct > 100;
  const isFull = !isOver && pct >= 95;
  const fillW = Math.min(pct, 100);
  const barColor = isOver
    ? `linear-gradient(90deg, #d43a1e, ${accent})`
    : isFull
    ? "linear-gradient(90deg, #b45a00, #F59E0B)"
    : "linear-gradient(90deg, #1fa368, #34D399)";
  const pctColor = isOver ? accent : isFull ? "#F59E0B" : "rgba(255,255,255,0.3)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
      <div style={{
        flex: 1, height: 4,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 99, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 99,
          width: `${fillW}%`,
          background: barColor,
          transition: "width 0.45s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
      <span style={{
        fontFamily: "var(--mono, monospace)", fontSize: 10, fontWeight: isOver || isFull ? 600 : 500,
        color: pctColor,
        minWidth: 30, textAlign: "right", flexShrink: 0,
      }}>
        {pct}%
      </span>
    </div>
  );
}

export function ByCategoryPage() {
  const T = useTheme();
  const { payments } = useConvertedPayments();
  const { range, props: rangeProps } = useRangeState("Month");
  const { categorize, getCategory, allCategories } = useCategorizer();
  const { categories: dbCategories } = useCategories();
  const { updateCategory } = useCategoryActions();

  const [openIds, setOpenIds]       = useState<Set<string>>(new Set());
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [limitEditId, setLimitEditId]   = useState<string | null>(null);
  const [limitDraft, setLimitDraft]     = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const monthPayments = useMemo(
    () => payments.filter(
      (p) => !p.excludedFromAnalytics && p.gelAmount !== null && isInRange(p.transactionDate, range)
    ),
    [payments, range]
  );

  useEffect(() => {
    setOpenIds(new Set());
    setSelectedTxId(null);
  }, [range]);

  const dbById = useMemo(
    () => new Map(dbCategories.map((c) => [c.id, c])),
    [dbCategories]
  );

  const cats: CatAgg[] = useMemo(() => {
    const map: Record<string, CatAgg> = {};
    for (const p of monthPayments) {
      if (p.gelAmount === null) continue;
      const cat = getCategory(p.merchant, p.rawMessage, p.id);
      if (!map[cat.id]) map[cat.id] = { cat: cat.id, total: 0, count: 0, meta: cat };
      map[cat.id].total += p.gelAmount;
      map[cat.id].count += 1;
    }
    // Surface zero-spend categories ONLY when they have a budget set,
    // so a budgeted category stays visible (with its limit + progress)
    // even in a range it had no spend. Zero-spend categories without a
    // limit are omitted — they'd just be noise.
    for (const c of allCategories) {
      if (map[c.id]) continue;
      if (!dbById.get(c.id)?.targetAmount) continue;
      map[c.id] = { cat: c.id, total: 0, count: 0, meta: c };
    }
    return Object.values(map).sort((a, b) => {
      const ao = dbById.get(a.cat)?.sortOrder;
      const bo = dbById.get(b.cat)?.sortOrder;
      if (ao !== undefined && bo !== undefined) return ao - bo;
      if (ao !== undefined) return -1;
      if (bo !== undefined) return 1;
      return b.total - a.total;
    });
  }, [monthPayments, getCategory, allCategories, dbById]);

  const txsByCat = useMemo(() => {
    const map: Record<string, InkTx[]> = {};
    for (const p of monthPayments) {
      const catId = categorize(p.merchant, p.rawMessage, p.id);
      if (!map[catId]) map[catId] = [];
      map[catId].push({
        id: p.id, kind: "payment" as const,
        merchant: p.merchant || "", rawMerchant: p.rawMessage,
        amount: p.amount, currency: p.currency,
        cardLastDigits: p.cardLastDigits, transactionDate: p.transactionDate,
        bankSenderId: p.bankSenderId, category: catId,
        rawMessage: p.rawMessage, excludedFromAnalytics: p.excludedFromAnalytics,
      });
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.transactionDate - a.transactionDate);
    }
    return map;
  }, [monthPayments, categorize]);

  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null;
    for (const txs of Object.values(txsByCat)) {
      const found = txs.find((t) => t.id === selectedTxId);
      if (found) return found;
    }
    return null;
  }, [selectedTxId, txsByCat]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = cats.findIndex((c) => c.cat === active.id);
    const newIdx = cats.findIndex((c) => c.cat === over.id);
    const reordered = arrayMove(cats, oldIdx, newIdx);
    reordered.forEach((c, i) => updateCategory(c.cat, { sortOrder: i }));
  };

  const visibleCats = useMemo(() => cats.filter((c) => !dbById.get(c.cat)?.viewHidden), [cats, dbById]);
  const hiddenCats  = useMemo(() => cats.filter((c) =>  dbById.get(c.cat)?.viewHidden), [cats, dbById]);

  const totalSpent    = useMemo(() => visibleCats.reduce((s, c) => s + c.total, 0), [visibleCats]);
  const totalTarget   = useMemo(
    () => visibleCats.reduce((s, c) => s + (dbById.get(c.cat)?.targetAmount ?? 0), 0),
    [visibleCats, dbById]
  );
  const totalTxCount  = useMemo(() => visibleCats.reduce((s, c) => s + c.count, 0), [visibleCats]);
  const catsWithTarget = useMemo(
    () => visibleCats.filter((c) => dbById.get(c.cat)?.targetAmount).length,
    [visibleCats, dbById]
  );

  const prevRanges = useMemo((): DateRange[] => {
    if (range.key === "Today" || range.key === "Custom") return [];
    const r1 = previousRange(range);
    const r2 = previousRange(r1);
    const r3 = previousRange(r2);
    return [r3, r2, r1];
  }, [range]);

  const sparklineData = useMemo(() => {
    if (prevRanges.length === 0) return {};
    const maps: Record<string, number>[] = prevRanges.map(() => ({}));
    for (const p of payments) {
      if (p.excludedFromAnalytics || p.gelAmount === null) continue;
      for (let i = 0; i < prevRanges.length; i++) {
        if (isInRange(p.transactionDate, prevRanges[i])) {
          const catId = categorize(p.merchant, p.rawMessage, p.id);
          maps[i][catId] = (maps[i][catId] ?? 0) + p.gelAmount;
        }
      }
    }
    const allCatIds = new Set(maps.flatMap((m) => Object.keys(m)));
    const result: Record<string, number[]> = {};
    for (const catId of allCatIds) result[catId] = maps.map((m) => m[catId] ?? 0);
    return result;
  }, [payments, prevRanges, categorize]);

  const prevCatTotals = useMemo(() => {
    const last = prevRanges[2];
    if (!last) return {};
    const map: Record<string, number> = {};
    for (const p of payments) {
      if (p.excludedFromAnalytics || p.gelAmount === null) continue;
      if (!isInRange(p.transactionDate, last)) continue;
      const catId = categorize(p.merchant, p.rawMessage, p.id);
      map[catId] = (map[catId] ?? 0) + p.gelAmount;
    }
    return map;
  }, [payments, prevRanges, categorize]);

  const saveLimitEdit = async (catId: string) => {
    const val = parseFloat(limitDraft);
    if (!isNaN(val) && val > 0) await updateCategory(catId, { targetAmount: val });
    setLimitEditId(null);
  };

  const clearLimit = async (catId: string) => {
    await updateCategory(catId, { targetAmount: undefined });
    setLimitEditId(null);
  };

  const remaining    = totalTarget - totalSpent;
  const isPositive   = remaining >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.density.gap }}>
      <PageHeader eyebrow="Transactions · by category" title="By Category" {...rangeProps} />

      {/* ── Summary stat cards ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: T.density.gap }}>
        <StatCard label="Total Spent"    value={formatGEL(totalSpent, { decimals: 0 })}        accentColor={T.accent}
          hint="Sum of all non-excluded payments converted to GEL for this range." />
        {totalTarget > 0 && (
          <StatCard label="Total Budget" value={formatGEL(totalTarget, { decimals: 0 })}       accentColor="#4A9EFF"
            sub={`${catsWithTarget} of ${visibleCats.length} categories have a limit`}
            hint="Sum of monthly GEL limits you set per category." />
        )}
        {totalTarget > 0 && (
          <StatCard label={isPositive ? "Remaining" : "Over budget"}
            value={(isPositive ? "" : "−") + formatGEL(Math.abs(remaining), { decimals: 0 })}
            accentColor={isPositive ? "#34D399" : T.accent}
            valueColor={isPositive ? "#34D399" : T.accent}
            hint={isPositive
              ? "Budget target minus total spent — how much you can still spend."
              : "Total spent exceeds the sum of your category limits."} />
        )}
        <StatCard label="Transactions"   value={String(totalTxCount)}                          accentColor="#A78BFA"
          sub={`across ${visibleCats.length} categories`}
          hint="Count of non-excluded payments in this range." />
      </div>

      {cats.length === 0 ? (
        <div style={{
          background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12,
          color: T.muted, fontSize: 13, padding: "48px 0", textAlign: "center",
        }}>
          No transactions in this range.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: selectedTx ? "1fr 340px" : "1fr",
          gap: T.density.gap, alignItems: "start",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleCats.map((c) => c.cat)} strategy={verticalListSortingStrategy}>
                {visibleCats.map((c, idx) => (
                  <SortableRow
                    key={c.cat} c={c} idx={idx}
                    isOpen={openIds.has(c.cat)}
                    txs={txsByCat[c.cat] ?? []}
                    selectedTxId={selectedTxId}
                    targetAmount={dbById.get(c.cat)?.targetAmount}
                    limitEditId={limitEditId} limitDraft={limitDraft}
                    prevTotal={prevCatTotals[c.cat]}
                    sparkValues={sparklineData[c.cat] ?? []}
                    sparkLabels={prevRanges.map((r) => r.label.split(" ")[0])}
                    T={T} accent={T.accent}
                    onToggle={toggle} onSelectTx={setSelectedTxId}
                    onLimitEdit={(id) => {
                      setLimitEditId(id);
                      setLimitDraft(String(dbById.get(id)?.targetAmount ?? ""));
                    }}
                    onLimitDraftChange={setLimitDraft}
                    onLimitSave={saveLimitEdit}
                    onLimitClear={clearLimit}
                    onHide={(id) => updateCategory(id, { viewHidden: true })}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {hiddenCats.length > 0 && (
              <ExcludedSection
                T={T} accent={T.accent}
                cats={hiddenCats} txsByCat={txsByCat}
                selectedTxId={selectedTxId}
                onRestore={(id) => updateCategory(id, { viewHidden: false })}
                onSelectTx={setSelectedTxId}
              />
            )}
          </div>

          {selectedTx && (
            <TxDetailPanel t={selectedTx} onClose={() => setSelectedTxId(null)} onDeleted={() => setSelectedTxId(null)} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, hint, accentColor, valueColor,
}: {
  label: string; value: string; sub?: string; hint?: string;
  accentColor: string; valueColor?: string;
}) {
  const T = useTheme();
  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.line}`,
      borderRadius: 12, padding: "12px 14px",
      position: "relative", overflow: "hidden",
      transition: "border-color 0.15s, transform 0.15s",
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.line;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Colored top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 2, background: accentColor,
      }} />
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.06em", color: T.dim, marginBottom: 8, fontFamily: T.sans,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: T.mono, fontSize: 24, fontWeight: 600,
        letterSpacing: "-0.03em", color: valueColor ?? T.text,
        marginBottom: 6, lineHeight: 1.1,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, lineHeight: 1.35 }}>{sub}</div>
      )}
      {hint && (
        <div style={{ fontSize: 10.5, color: T.faint, fontFamily: T.sans, marginTop: 4, lineHeight: 1.45 }}>{hint}</div>
      )}
    </div>
  );
}

// ── Sortable category card ────────────────────────────────────────────────────
function SortableRow({
  c, isOpen, txs, selectedTxId, targetAmount, limitEditId, limitDraft,
  prevTotal, sparkValues, sparkLabels, T, accent,
  onToggle, onSelectTx, onLimitEdit, onLimitDraftChange, onLimitSave, onLimitClear, onHide,
}: {
  c: CatAgg; idx?: number; isOpen: boolean; txs: InkTx[];
  selectedTxId: string | null; targetAmount: number | undefined;
  limitEditId: string | null; limitDraft: string;
  prevTotal?: number; sparkValues: number[]; sparkLabels: string[];
  T: ReturnType<typeof useTheme>; accent: string;
  onToggle: (id: string) => void; onSelectTx: (id: string | null) => void;
  onLimitEdit: (id: string) => void; onLimitDraftChange: (v: string) => void;
  onLimitSave: (id: string) => Promise<void>; onLimitClear: (id: string) => Promise<void>;
  onHide: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.cat });
  const isEditingLimit = limitEditId === c.cat;
  const pct = targetAmount ? (c.total / targetAmount) * 100 : 0;
  const isOver = pct > 100;
  const isFull = !isOver && pct >= 95;

  const delta = prevTotal && prevTotal > 0
    ? ((c.total - prevTotal) / prevTotal) * 100
    : null;

  const cardBg    = isOver ? `rgba(255,90,58,0.06)` : isFull ? `rgba(245,158,11,0.05)` : T.panel;
  const cardBorder = isOver ? `3px solid ${accent}` : isFull ? `3px solid #F59E0B` : `1px solid ${T.line}`;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <div style={{
        background: cardBg,
        border: "1px solid transparent",
        borderLeft: cardBorder,
        borderRadius: 12,
        padding: (isOver || isFull) ? "3px 8px 3px 6px" : "3px 8px",
        transition: "background 0.2s, border-color 0.2s",
        cursor: "pointer",
      }}
        onClick={() => onToggle(c.cat)}
        onMouseEnter={(e) => {
          if (!isOver && !isFull) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)";
          (e.currentTarget as HTMLDivElement).style.background = isOver
            ? "rgba(255,90,58,0.09)" : isFull ? "rgba(245,158,11,0.08)" : T.panelAlt;
        }}
        onMouseLeave={(e) => {
          if (!isOver && !isFull) (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
          (e.currentTarget as HTMLDivElement).style.background = cardBg;
        }}
      >
        {/* ── Main row ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: targetAmount ? 0 : 0 }}>
          {/* Grip */}
          <span
            {...attributes} {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={{ color: T.faint, cursor: "grab", flexShrink: 0, display: "flex", alignItems: "center", opacity: 0.4 }}
          >
            <GripIcon />
          </span>

          {/* Icon */}
          <div style={{
            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            background: c.meta.color + "28",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12,
          }}>
            {c.meta.icon}
          </div>

          {/* Name + OVER badge */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.sans }}>
              {c.meta.name}
            </span>
            {isOver && (
              <span style={{
                fontFamily: T.mono, fontSize: 10, fontWeight: 600,
                padding: "2px 7px", borderRadius: 4,
                background: accent + "1A", color: accent,
                letterSpacing: "0.04em", flexShrink: 0,
              }}>OVER</span>
            )}
            {isFull && (
              <span style={{
                fontFamily: T.mono, fontSize: 10, fontWeight: 600,
                padding: "2px 7px", borderRadius: 4,
                background: "rgba(245,158,11,0.12)", color: "#F59E0B",
                letterSpacing: "0.04em", flexShrink: 0,
              }}>FULL</span>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: T.mono, fontSize: 11, flexShrink: 0 }}>
            <span style={{ color: T.faint, minWidth: 36, textAlign: "right" }}>{c.count} tx</span>

            {/* Budget limit — editable */}
            {isEditingLimit ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>₾</span>
                <input
                  autoFocus type="number" value={limitDraft}
                  onChange={(e) => onLimitDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") onLimitSave(c.cat);
                  }}
                  onBlur={() => onLimitSave(c.cat)}
                  placeholder="0"
                  style={{
                    width: 60, padding: "3px 6px",
                    background: T.panelAlt, border: `1px solid ${T.line}`,
                    borderRadius: 6, color: T.text, fontSize: 12, fontFamily: T.mono, outline: "none",
                  }}
                />
                {!!targetAmount && (
                  <button type="button" onClick={() => onLimitClear(c.cat)}
                    style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 13, padding: "0 2px" }}
                    title="Remove limit">×</button>
                )}
              </div>
            ) : targetAmount ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}
                onClick={(e) => { e.stopPropagation(); onLimitEdit(c.cat); }}>
                <span style={{ color: T.dim, minWidth: 60, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  /{formatGEL(targetAmount, { decimals: 0 })}
                </span>
                <span style={{ fontSize: 9, color: T.faint }}>✎</span>
              </div>
            ) : (
              <button type="button"
                onClick={(e) => { e.stopPropagation(); onLimitEdit(c.cat); }}
                style={{
                  background: "transparent", border: "none", color: T.faint,
                  fontSize: 11, fontFamily: T.mono, cursor: "pointer", padding: "0 2px",
                }}
                title="Set monthly limit">+ limit</button>
            )}

            {/* Spent amount */}
            <span style={{
              fontWeight: 600, fontSize: 13, minWidth: 56, textAlign: "right",
              color: isOver ? accent : T.text, fontVariantNumeric: "tabular-nums",
            }}>
              {formatGEL(c.total, { decimals: 0 })}
            </span>

            {/* Delta vs previous period */}
            {delta !== null && (
              <span style={{
                fontSize: 11, fontWeight: 600, minWidth: 38, textAlign: "right",
                color: delta > 0 ? accent : "#34D399",
              }}>
                {delta > 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
              </span>
            )}

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button type="button" title="Exclude from this view"
                onClick={(e) => { e.stopPropagation(); onHide(c.cat); }}
                style={{
                  background: "transparent", border: "none", color: T.faint,
                  cursor: "pointer", width: 26, height: 26, borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.color = T.text;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = T.faint;
                }}
              >⊖</button>

              <motion.span
                animate={{ rotate: isOpen ? 0 : -90 }}
                transition={{ duration: 0.15 }}
                style={{ fontSize: 11, color: T.dim, display: "inline-block", width: 26, textAlign: "center" }}
              >▾</motion.span>
            </div>
          </div>
        </div>

        {/* ── Progress bar ── */}
        {targetAmount ? (
          <ProgressBar spent={c.total} budget={targetAmount} accent={accent} />
        ) : null}

        {/* ── Expanded: sparkline + transactions ── */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key={c.cat}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 4 }}>
                {sparkValues.length >= 2 && (
                  <div style={{
                    padding: "10px 0 6px", borderBottom: `1px solid ${T.line}`,
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, whiteSpace: "nowrap" }}>
                      prev periods
                    </span>
                    <Sparkline values={sparkValues} labels={sparkLabels} color={c.meta.color} T={T} />
                  </div>
                )}
                <div style={{ paddingBottom: 4 }}>
                  {txs.map((t, i) => (
                    <TxRow key={t.id} t={t} isLast={i === txs.length - 1} compact
                      selected={t.id === selectedTxId}
                      onClick={() => onSelectTx(t.id === selectedTxId ? null : t.id)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Excluded section ──────────────────────────────────────────────────────────
function ExcludedSection({
  T, cats, txsByCat, selectedTxId, onRestore, onSelectTx,
}: {
  T: ReturnType<typeof useTheme>; accent?: string;
  cats: CatAgg[]; txsByCat: Record<string, InkTx[]>;
  selectedTxId: string | null;
  onRestore: (id: string) => void;
  onSelectTx: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const totalExcluded = cats.reduce((s, c) => s + c.total, 0);

  const toggleCat = (id: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div style={{ marginTop: 12 }}>
      {/* Dashed separator */}
      <div style={{ borderTop: "1px dashed rgba(255,255,255,0.08)", paddingTop: 16 }}>
        <div
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer", color: T.dim, fontSize: 13, fontWeight: 500,
            padding: "6px 0", userSelect: "none", transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.color = T.muted; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.color = T.dim; }}
        >
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}
            style={{ display: "inline-block", fontSize: 11 }}>▾</motion.span>
          <span>Excluded categories</span>
          <span style={{
            fontFamily: T.mono, fontSize: 11,
            background: "rgba(255,255,255,0.04)",
            padding: "1px 8px", borderRadius: 10,
          }}>{cats.length}</span>
          <span style={{ marginLeft: "auto", fontFamily: T.mono, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            {formatGEL(totalExcluded, { decimals: 0 })}
          </span>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                {cats.map((c) => {
                  const txs = txsByCat[c.cat] ?? [];
                  const isCatOpen = openCats.has(c.cat);
                  return (
                    <div key={c.cat}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.015)",
                        border: "1px dashed rgba(255,255,255,0.06)",
                        borderRadius: 8, opacity: 0.6, transition: "opacity 0.15s",
                        cursor: "pointer",
                      }}
                        onClick={() => toggleCat(c.cat)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.9"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0.6"; }}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                          background: c.meta.color + "28",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13,
                        }}>{c.meta.icon}</div>
                        <span style={{ flex: 1, fontSize: 13, color: T.muted, fontFamily: T.sans, fontWeight: 500 }}>
                          {c.meta.name}
                        </span>
                        <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{txs.length} tx</span>
                        <span style={{ fontSize: 13, color: T.muted, fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>
                          {formatGEL(c.total, { decimals: 0 })}
                        </span>
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); onRestore(c.cat); }}
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${T.line}`,
                            borderRadius: 6, color: T.muted,
                            fontSize: 11, fontFamily: T.sans, cursor: "pointer",
                            padding: "4px 12px", transition: "all 0.15s", whiteSpace: "nowrap",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                            (e.currentTarget as HTMLButtonElement).style.color = T.text;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                            (e.currentTarget as HTMLButtonElement).style.color = T.muted;
                          }}
                        >Restore</button>
                        <motion.span animate={{ rotate: isCatOpen ? 0 : -90 }} transition={{ duration: 0.15 }}
                          style={{ fontSize: 11, color: T.dim, display: "inline-block" }}>▾</motion.span>
                      </div>
                      <AnimatePresence initial={false}>
                        {isCatOpen && (
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
                                <TxRow key={t.id} t={t} isLast={i === txs.length - 1} compact
                                  selected={t.id === selectedTxId}
                                  onClick={() => onSelectTx(t.id === selectedTxId ? null : t.id)}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, labels, color, T }: {
  values: number[]; labels: string[]; color: string; T: ReturnType<typeof useTheme>;
}) {
  const w = 120, h = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 4 - (v / max) * (h - 8);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <svg width={w} height={h} style={{ overflow: "visible" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
        {values.map((v, i) => {
          const x = (i / (values.length - 1)) * w;
          const y = h - 4 - (v / max) * (h - 8);
          return <circle key={i} cx={x} cy={y} r={2.5} fill={color} opacity={0.9} />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", width: w }}>
        {labels.map((l, i) => (
          <span key={i} style={{ fontSize: 9, color: T.faint, fontFamily: T.mono }}>
            {l.slice(0, 3).toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
