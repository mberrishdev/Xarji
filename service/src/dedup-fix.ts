/**
 * Find and remove duplicate transactions from InstantDB.
 *
 * Groups by: calendar day + merchant name (case-insensitive).
 * Within each group, also checks for exact transactionId matches.
 * Shows the full list, keeps the entry with the most complete data,
 * and tombstones deleted ids in state.db so Resync All won't re-import them.
 *
 * Run with:  bun run src/dedup-fix.ts
 */
import { init } from "@instantdb/admin";
import { loadConfig } from "./config";
import { StateDb, type TombstoneKind } from "./state-db";
import schema from "./instant-schema";

const config = loadConfig();
if (!config.instantdb.enabled || !config.instantdb.appId || !config.instantdb.adminToken) {
  console.error("InstantDB not configured.");
  process.exit(1);
}

const db = init({ appId: config.instantdb.appId, adminToken: config.instantdb.adminToken, schema });

const res = await db.query({
  payments:       { $: { limit: 100000 } },
  failedPayments: { $: { limit: 100000 } },
  credits:        { $: { limit: 100000 } },
});

type Row = {
  id: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  merchant?: string;
  transactionDate?: number;
  bankSenderId?: string;
};

function day(r: Row) {
  return r.transactionDate ? new Date(r.transactionDate).toISOString().slice(0, 10) : "?";
}

function score(r: Row) {
  return (r.merchant ? 2 : 0) + (r.transactionId ? 1 : 0) + (r.bankSenderId ? 1 : 0);
}

function groupKey(r: Row) {
  const d = day(r);
  const title = (r.merchant ?? "").toLowerCase().trim();
  return `${d}|${title}`;
}

function findDuplicates(rows: Row[]): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const k = groupKey(row);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  // Only return groups with more than one entry
  for (const [k, group] of groups) {
    if (group.length < 2) groups.delete(k);
  }
  return groups;
}

const tables = [
  { name: "payments",       rows: (res.payments       ?? []) as Row[] },
  { name: "failedPayments", rows: (res.failedPayments ?? []) as Row[] },
  { name: "credits",        rows: (res.credits        ?? []) as Row[] },
];

// Build id → table lookup
const idToTable = new Map<string, string>();
for (const { name, rows } of tables) for (const r of rows) idToTable.set(r.id, name);

const toDeleteIds = new Set<string>();
let totalGroups = 0;

for (const { name, rows } of tables) {
  const groups = findDuplicates(rows);
  if (groups.size === 0) continue;

  console.log(`\n━━ ${name} — ${groups.size} duplicate group(s) ━━`);

  for (const group of groups.values()) {
    group.sort((a, b) => score(b) - score(a));
    const keep = group[0];
    const remove = group.slice(1);

    console.log(`\n  Date:     ${day(keep)}`);
    console.log(`  Merchant: ${keep.merchant ?? "—"}`);
    console.log(`  Amount:   ${keep.amount} ${keep.currency}`);
    console.log(`  Bank:     ${keep.bankSenderId ?? "?"}`);
    console.log(`  Entries:  ${group.length}`);
    console.log(`    [KEEP]   id=${keep.id.slice(0, 8)}…  txId=${keep.transactionId?.slice(0, 12) ?? "none"}…`);
    for (const r of remove) {
      console.log(`    [DELETE] id=${r.id.slice(0, 8)}…  txId=${r.transactionId?.slice(0, 12) ?? "none"}…  merchant="${r.merchant ?? "—"}"`);
      toDeleteIds.add(r.id);
    }
    totalGroups++;
  }
}

if (toDeleteIds.size === 0) {
  console.log("\nNo duplicates found.");
  process.exit(0);
}

console.log(`\n─────────────────────────────────────────`);
console.log(`${toDeleteIds.size} row(s) to delete across ${totalGroups} group(s).`);
process.stdout.write("Delete and tombstone? (y/N) ");

const answer = await new Promise<string>((resolve) => {
  process.stdin.setEncoding("utf8");
  process.stdin.once("data", (d) => resolve(String(d).trim()));
});

if (answer.toLowerCase() !== "y") { console.log("Aborted."); process.exit(0); }

const ops = [...toDeleteIds].map((id) => (db.tx as any)[idToTable.get(id)!][id].delete());
await db.transact(ops);

// Tombstone in state.db so Resync All never re-imports these
const stateDb = new StateDb(config.stateDbPath);
const tableToKind: Record<string, TombstoneKind> = {
  payments: "payment",
  failedPayments: "failedPayment",
  credits: "credit",
};
let tombstoned = 0;
for (const { name, rows } of tables) {
  for (const r of rows) {
    if (toDeleteIds.has(r.id) && r.transactionId) {
      stateDb.markTransactionDeleted(r.transactionId, tableToKind[name]);
      tombstoned++;
    }
  }
}
stateDb.close();

console.log(`Done — deleted ${toDeleteIds.size} row(s), tombstoned ${tombstoned} id(s).`);
process.exit(0);
