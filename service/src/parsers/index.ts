/**
 * Parser registry + public entry points.
 *
 * Adding a new bank:
 *   1. Create `./<bank>.ts` that exports a `BankParser`.
 *   2. Import + register it below.
 */

import type { RawMessage } from "../db-reader";
import type { BankParser, ParseResult, Transaction } from "./types";
import { soloParser } from "./solo";
import { tbcParser } from "./tbc";

export type { BankParser, ParseResult, Transaction } from "./types";
export type {
  TransactionKind,
  TransactionStatus,
  TransactionDirection,
} from "./types";

const PARSERS: readonly BankParser[] = [soloParser, tbcParser];

// Pre-compute sender-id -> parser map for fast lookup.
const PARSER_BY_SENDER: Map<string, BankParser> = new Map();
for (const p of PARSERS) {
  for (const id of p.senderIds) PARSER_BY_SENDER.set(id, p);
}

export function getParserForSender(senderId: string): BankParser | null {
  return PARSER_BY_SENDER.get(senderId) ?? null;
}

export function allBanks(): readonly BankParser[] {
  return PARSERS;
}

/**
 * Parse a single raw message.
 * Returns "skip" for explicitly recognised non-transactions (OTP, marketing,
 * self-transfer), null for unrecognised formats, Transaction otherwise.
 */
export function parseMessage(raw: RawMessage): Transaction | "skip" | null {
  const parser = getParserForSender(raw.senderId);
  if (!parser) return null;
  return parser.parse(raw);
}

/**
 * Bulk parse.
 * - success: parseable transactions
 * - skipped: known non-transactions (OTP/marketing/self-transfer) — cursor safe to advance
 * - failed:  unrecognised formats — cursor must stop before the first of these
 */
export function parseMessages(messages: readonly RawMessage[]): ParseResult {
  const success: Transaction[] = [];
  const skipped: RawMessage[] = [];
  const failed: RawMessage[] = [];
  for (const msg of messages) {
    const result = parseMessage(msg);
    if (result === "skip") skipped.push(msg);
    else if (result === null) failed.push(msg);
    else success.push(result);
  }
  return { success, skipped, failed };
}

export function filterByStatus(
  transactions: readonly Transaction[],
  status: "success" | "failed"
): Transaction[] {
  return transactions.filter((tx) => tx.status === status);
}
