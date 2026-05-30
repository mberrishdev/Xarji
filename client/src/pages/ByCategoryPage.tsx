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
import { Card, PageHeader } from "../ink/primitives";
import { TxRow, type InkTx } from "../ink/TxRow";
import { TxDetailPanel } from "../components/TxDetailPanel";
import { useConvertedPayments } from "../hooks/useTransactions";
import { useCategorizer } from "../hooks/useCategorizer";
import { useCategories, useCategoryActions } from "../hooks/useCategories";
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
  const { categories: dbCategories } = useCategories();
  const { updateCategory } = useCategoryActions();

  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [limitEditId, setLimitEditId] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const monthPayments = useMemo(
    () =>
      payments.filter(
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
    return Object.values(map).sort((a, b) => {
      const ao = dbById.get(a.cat)?.sortOrder;
      const bo = dbById.get(b.cat)?.sortOrder;
      if (ao !== undefined && bo !== undefined) return ao - bo;
      if (ao !== undefined) return -1;
      if (bo !== undefined) return 1;
      return b.total - a.total;
    });
  }, [monthPayments, getCategory, dbById]);

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
  const hiddenCats = useMemo(() => cats.filter((c) => dbById.get(c.cat)?.viewHidden), [cats, dbById]);

  const totalSpent = useMemo(() => visibleCats.reduce((s, c) => s + c.total, 0), [visibleCats]);
  const totalTarget = useMemo(
    () => visibleCats.reduce((s, c) => s + (dbById.get(c.cat)?.targetAmount ?? 0), 0),
    [visibleCats, dbById]
  );
  const totalTxCount = useMemo(() => visibleCats.reduce((s, c) => s + c.count, 0), [visibleCats]);
  const catsWithTarget = useMemo(() => visibleCats.filter((c) => dbById.get(c.cat)?.targetAmount).length, [visibleCats, dbById]);

  const saveLimitEdit = async (catId: string) => {
    const val = parseFloat(limitDraft);
    if (!isNaN(val) && val > 0) {
      await updateCategory(catId, { targetAmount: val });
    }
    setLimitEditId(null);
  };

  const clearLimit = async (catId: string) => {
    await updateCategory(catId, { targetAmount: undefined });
    setLimitEditId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.density.gap }}>
      <PageHeader eyebrow="Transactions · by category" title="By Category" {...rangeProps} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: T.density.gap }}>
        <SummaryTile
          T={T}
          label="Total spent"
          value={formatGEL(totalSpent, { decimals: 0 })}
          accent={T.text}
          hint="Sum of all non-excluded payments converted to GEL for this range."
        />
        {totalTarget > 0 && (
          <SummaryTile
            T={T}
            label="Total budget"
            value={formatGEL(totalTarget, { decimals: 0 })}
            sub={`${catsWithTarget} of ${visibleCats.length} categories have a limit`}
            hint="Sum of monthly GEL limits you set per category."
          />
        )}
        {totalTarget > 0 && (
          <SummaryTile
            T={T}
            label={totalSpent > totalTarget ? "Over budget" : "Remaining"}
            value={formatGEL(Math.abs(totalTarget - totalSpent), { decimals: 0 })}
            accent={totalSpent > totalTarget ? T.accent : "#4BD9A2"}
            hint={totalSpent > totalTarget
              ? "Total spent exceeds the sum of your category limits."
              : "Budget target minus total spent — how much you can still spend."}
          />
        )}
        <SummaryTile
          T={T}
          label="Transactions"
          value={String(totalTxCount)}
          sub={`across ${visibleCats.length} categories`}
          hint="Count of non-excluded payments in this range."
        />
      </div>

      {cats.length === 0 ? (
        <Card>
          <div style={{ color: T.muted, fontSize: 13, padding: "48px 0", textAlign: "center", fontFamily: T.sans }}>
            No transactions in this range.
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedTx ? "1fr 340px" : "1fr",
            gap: T.density.gap,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: T.density.gap }}>
            <Card pad="0">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleCats.map((c) => c.cat)} strategy={verticalListSortingStrategy}>
                  <div style={{ overflowY: "auto" }}>
                    {visibleCats.map((c, idx) => (
                      <SortableRow
                        key={c.cat}
                        c={c}
                        idx={idx}
                        total={visibleCats.length}
                        isOpen={openIds.has(c.cat)}
                        txs={txsByCat[c.cat] ?? []}
                        selectedTxId={selectedTxId}
                        targetAmount={dbById.get(c.cat)?.targetAmount}
                        limitEditId={limitEditId}
                        limitDraft={limitDraft}
                        T={T}
                        onToggle={toggle}
                        onSelectTx={setSelectedTxId}
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
                  </div>
                </SortableContext>
              </DndContext>
            </Card>

            {hiddenCats.length > 0 && (
              <ExcludedSection
                T={T}
                cats={hiddenCats}
                txsByCat={txsByCat}
                selectedTxId={selectedTxId}
                onRestore={(id) => updateCategory(id, { viewHidden: false })}
                onSelectTx={setSelectedTxId}
              />
            )}
          </div>

          {selectedTx && (
            <TxDetailPanel
              t={selectedTx}
              onClose={() => setSelectedTxId(null)}
              onDeleted={() => setSelectedTxId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SortableRow({
  c,
  idx,
  total,
  isOpen,
  txs,
  selectedTxId,
  targetAmount,
  limitEditId,
  limitDraft,
  T,
  onToggle,
  onSelectTx,
  onLimitEdit,
  onLimitDraftChange,
  onLimitSave,
  onLimitClear,
  onHide,
}: {
  c: CatAgg;
  idx: number;
  total: number;
  isOpen: boolean;
  txs: InkTx[];
  selectedTxId: string | null;
  targetAmount: number | undefined;
  limitEditId: string | null;
  limitDraft: string;
  T: ReturnType<typeof useTheme>;
  onToggle: (id: string) => void;
  onSelectTx: (id: string | null) => void;
  onLimitEdit: (id: string) => void;
  onLimitDraftChange: (v: string) => void;
  onLimitSave: (id: string) => Promise<void>;
  onLimitClear: (id: string) => Promise<void>;
  onHide: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.cat });
  const isLastCat = idx === total - 1;
  const isEditingLimit = limitEditId === c.cat;
  const pct = targetAmount ? (c.total / targetAmount) * 100 : 0;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <div
        onClick={() => onToggle(c.cat)}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = T.panelAlt; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 20px 13px 16px",
          cursor: "pointer",
          borderBottom: !isLastCat || isOpen || !!targetAmount ? `1px solid ${T.line}` : "none",
          userSelect: "none",
        }}
      >
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            color: T.faint,
            cursor: "grab",
            flexShrink: 0,
            lineHeight: 1,
            paddingRight: 2,
          }}
        >
          ⠿
        </span>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: c.meta.color, flexShrink: 0 }} />
        <span style={{ fontFamily: T.mono, fontSize: 14, color: T.muted, flexShrink: 0 }}>{c.meta.icon}</span>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.text, fontFamily: T.sans }}>
          {c.meta.name}
        </span>
        <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginRight: 4 }}>{c.count} tx</span>

        {isEditingLimit ? (
          <div
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>₾</span>
            <input
              autoFocus
              type="number"
              value={limitDraft}
              onChange={(e) => onLimitDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onLimitSave(c.cat);
                if (e.key === "Escape") onLimitSave(c.cat);
              }}
              onBlur={() => onLimitSave(c.cat)}
              placeholder="0"
              style={{
                width: 60,
                padding: "3px 6px",
                background: T.panelAlt,
                border: `1px solid ${T.line}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 12,
                fontFamily: T.mono,
                outline: "none",
              }}
            />
            {!!targetAmount && (
              <button
                type="button"
                onClick={() => onLimitClear(c.cat)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.dim,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: "0 2px",
                  lineHeight: 1,
                }}
                title="Remove limit"
              >
                ×
              </button>
            )}
          </div>
        ) : targetAmount ? (
          <div
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            onClick={(e) => { e.stopPropagation(); onLimitEdit(c.cat); }}
          >
            <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>
              /{formatGEL(targetAmount, { decimals: 0 })}
            </span>
            <span style={{ fontSize: 9, color: T.faint }}>✎</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onLimitEdit(c.cat); }}
            style={{
              background: "transparent",
              border: "none",
              color: T.faint,
              fontSize: 11,
              fontFamily: T.mono,
              cursor: "pointer",
              padding: "0 2px",
              lineHeight: 1,
            }}
            title="Set monthly limit"
          >
            + limit
          </button>
        )}

        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            fontFamily: T.sans,
            fontVariantNumeric: "tabular-nums",
            color: T.text,
            marginLeft: 4,
            minWidth: 52,
            textAlign: "right",
          }}
        >
          {formatGEL(c.total, { decimals: 0 })}
        </span>
        <button
          type="button"
          title="Exclude from this view"
          onClick={(e) => { e.stopPropagation(); onHide(c.cat); }}
          style={{
            background: "transparent",
            border: "none",
            color: T.faint,
            fontSize: 13,
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: 1,
            marginLeft: 2,
          }}
        >
          ⊖
        </button>
        <motion.span
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, display: "inline-block", marginLeft: 4 }}
        >
          ▾
        </motion.span>
      </div>

      {!!targetAmount && (
        <div style={{ height: 3, background: T.line, margin: "0 20px", marginTop: -1 }}>
          <div
            style={{
              height: 3,
              width: `${Math.min(pct, 100)}%`,
              background: pct > 100 ? T.accent : pct > 80 ? "#F1B84A" : "#4BD9A2",
              borderRadius: 2,
              transition: "width 0.35s ease",
            }}
          />
        </div>
      )}

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
                <TxRow
                  key={t.id}
                  t={t}
                  isLast={i === txs.length - 1}
                  compact
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
}

function ExcludedSection({
  T,
  cats,
  txsByCat,
  selectedTxId,
  onRestore,
  onSelectTx,
}: {
  T: ReturnType<typeof useTheme>;
  cats: CatAgg[];
  txsByCat: Record<string, InkTx[]>;
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
    <Card pad="0">
      <div
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = T.panelAlt; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 20px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: T.muted, fontFamily: T.sans }}>
          Excluded categories
        </span>
        <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{cats.length}</span>
        <span style={{ fontSize: 12, color: T.dim, fontFamily: T.sans, fontVariantNumeric: "tabular-nums" }}>
          {formatGEL(totalExcluded, { decimals: 0 })}
        </span>
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, display: "inline-block" }}
        >
          ▾
        </motion.span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden", borderTop: `1px solid ${T.line}` }}
          >
            {cats.map((c, idx) => {
              const txs = txsByCat[c.cat] ?? [];
              const isCatOpen = openCats.has(c.cat);
              const isLast = idx === cats.length - 1;
              return (
                <div key={c.cat}>
                  <div
                    onClick={() => toggleCat(c.cat)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = T.panelAlt; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 20px",
                      borderBottom: !isLast || isCatOpen ? `1px solid ${T.line}` : "none",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: c.meta.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted, flexShrink: 0 }}>{c.meta.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, color: T.muted, fontFamily: T.sans }}>{c.meta.name}</span>
                    <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{txs.length} tx</span>
                    <span style={{ fontSize: 13, color: T.muted, fontFamily: T.sans, fontVariantNumeric: "tabular-nums" }}>
                      {formatGEL(c.total, { decimals: 0 })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRestore(c.cat); }}
                      title="Restore to main view"
                      style={{
                        background: "transparent",
                        border: `1px solid ${T.line}`,
                        borderRadius: 6,
                        color: T.muted,
                        fontSize: 11,
                        fontFamily: T.sans,
                        cursor: "pointer",
                        padding: "3px 8px",
                      }}
                    >
                      Restore
                    </button>
                    <motion.span
                      animate={{ rotate: isCatOpen ? 0 : -90 }}
                      transition={{ duration: 0.15 }}
                      style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, display: "inline-block" }}
                    >
                      ▾
                    </motion.span>
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
                            <TxRow
                              key={t.id}
                              t={t}
                              isLast={i === txs.length - 1}
                              compact
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
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function SummaryTile({
  T,
  label,
  value,
  sub,
  hint,
  accent,
}: {
  T: ReturnType<typeof useTheme>;
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card pad="16px 20px">
      <div style={{ fontSize: 11, color: T.muted, fontFamily: T.sans, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent ?? T.text, fontFamily: T.sans, letterSpacing: -0.8, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 5 }}>{sub}</div>
      )}
      {hint && (
        <div style={{ fontSize: 10.5, color: T.faint, fontFamily: T.sans, marginTop: 6, lineHeight: 1.45 }}>
          {hint}
        </div>
      )}
    </Card>
  );
}
