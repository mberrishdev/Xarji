/**
 * One-shot diagnostic: breaks down the current month by bank + kind so you
 * can verify dashboard totals against chat.db. Run with:
 *   bun run src/diagnose-month.ts
 */
import { MessagesDbReader } from "./db-reader";
import { parseMessage, allBanks } from "./parsers";
import { loadConfig } from "./config";

const config = loadConfig();
const reader = new MessagesDbReader(config.messagesDbPath);

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
const monthStart = new Date(y, m, 1).getTime();
const monthEnd = new Date(y, m + 1, 1).getTime();

const allSenders = new Set<string>();
for (const p of allBanks()) for (const id of p.senderIds) allSenders.add(id);

type Row = { bank: string; kind: string; direction: string; status: string; amount: number; currency: string; date: string; merchant: string };
const rows: Row[] = [];

for (const s of allSenders) {
  const msgs = reader.getMessagesBySender(s, 5000);
  for (const raw of msgs) {
    if (raw.timestamp.getTime() < monthStart || raw.timestamp.getTime() >= monthEnd) continue;
    const tx = parseMessage(raw);
    if (!tx || tx.amount === null) continue;
    rows.push({
      bank: tx.bankKey,
      kind: tx.transactionType,
      direction: tx.direction,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      date: tx.transactionDate.toISOString().slice(0, 10),
      merchant: tx.merchant ?? tx.counterparty ?? "—",
    });
  }
}

reader.close();

rows.sort((a, b) => a.date.localeCompare(b.date));

console.log(`\nMonth: ${y}-${String(m + 1).padStart(2, "0")}`);
console.log(`Raw parsed transactions: ${rows.length}\n`);

const byKind: Record<string, { gel: number; count: number }> = {};
for (const r of rows) {
  const key = `${r.bank} ${r.kind} (${r.direction})`;
  if (!byKind[key]) byKind[key] = { gel: 0, count: 0 };
  byKind[key].count += 1;
  if (r.currency === "GEL") byKind[key].gel += r.amount;
}

console.log("By bank + kind (GEL amounts only):");
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].gel - a[1].gel)) {
  console.log(`  ${String(v.count).padStart(3)}× ${k.padEnd(40)}  ₾${v.gel.toFixed(2)}`);
}

console.log(`\nPer-row detail:`);
for (const r of rows) {
  const sign = r.direction === "in" ? "+" : "−";
  console.log(
    `  ${r.date}  ${r.bank.padEnd(4)} ${r.kind.padEnd(16)} ${sign}${r.currency} ${String(r.amount).padStart(10)}  ${r.merchant}`
  );
}

const gelOut = rows.filter((r) => r.direction === "out" && r.currency === "GEL").reduce((s, r) => s + r.amount, 0);
const gelIn = rows.filter((r) => r.direction === "in" && r.currency === "GEL").reduce((s, r) => s + r.amount, 0);

console.log(`\nTotals (GEL only):`);
console.log(`  Outgoing: ₾${gelOut.toFixed(2)}`);
console.log(`  Incoming: ₾${gelIn.toFixed(2)}`);
console.log(`  Net:      ${gelIn - gelOut >= 0 ? "+" : "−"}₾${Math.abs(gelIn - gelOut).toFixed(2)}`);
