import type { RawMessage } from "../db-reader";

/**
 * Canonical transaction kinds. Banks use different words for the same
 * concept; we normalise to this set so the UI doesn't have to care.
 *
 * Direction is derivable: everything except `deposit` and `transfer_in`
 * is money leaving the account.
 */
export type TransactionKind =
  | "payment"            // outgoing card purchase
  | "payment_failed"     // declined card purchase
  | "atm_withdrawal"     // outgoing cash from ATM
  | "transfer_out"       // outgoing transfer to another account
  | "transfer_in"        // incoming transfer (Phase 2)
  | "loan_repayment"     // outgoing loan payment
  | "deposit"            // incoming salary / topup (Phase 2)
  | "unknown";

export type TransactionStatus = "success" | "failed";
export type TransactionDirection = "out" | "in";

export interface Transaction {
  id: string;
  messageId: number;
  bankKey: string;              // canonical bank, e.g. "SOLO" / "TBC"
  bankSenderId: string;         // the raw sender ID from Messages.app
  transactionType: TransactionKind;
  status: TransactionStatus;
  direction: TransactionDirection;
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardLastDigits: string | null;
  transactionDate: Date;
  messageTimestamp: Date;
  rawMessage: string;
  failureReason: string | null;
  balance: number | null;
  plusEarned: number | null;
  plusTotal: number | null;
  // Optional: for transfer-style kinds we may know the counterparty name.
  counterparty: string | null;
}

export interface ParseResult {
  success: Transaction[];
  failed: RawMessage[];
}

/**
 * A bank parser owns everything specific to one bank: which raw sender IDs
 * belong to it, how to recognise its SMS kinds, and how to extract fields.
 *
 * Adding a new bank = write a new module that exports a BankParser and
 * register it in `parsers/index.ts`.
 */
export interface BankParser {
  bankKey: string;
  senderIds: readonly string[];
  parse(raw: RawMessage): Transaction | null;
}

export function directionOf(kind: TransactionKind): TransactionDirection {
  if (kind === "transfer_in" || kind === "deposit") return "in";
  return "out";
}
