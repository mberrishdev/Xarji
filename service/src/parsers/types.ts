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
  | "reversal"           // card payment reversed / refunded back to account
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
  /** Explicitly recognised non-transactions (OTP, marketing, self-transfer).
   *  The cursor is allowed to advance past these. */
  skipped: RawMessage[];
  /** Unrecognised format — parser returned null. Cursor stops before the
   *  first of these so a future parser upgrade can retroactively pick them up. */
  failed: RawMessage[];
}

/**
 * A bank parser owns everything specific to one bank: which raw sender IDs
 * belong to it, how to recognise its SMS kinds, and how to extract fields.
 *
 * Adding a new bank = write a new module that exports a BankParser and
 * register it in `parsers/index.ts`.
 *
 * Return semantics:
 *   Transaction — parsed successfully, sync it and advance cursor.
 *   "skip"      — message is a known non-transaction (OTP, marketing,
 *                 self-transfer). Cursor advances past it; nothing synced.
 *   null        — format not recognised. Cursor stops before this message
 *                 so a future parser upgrade can pick it up.
 */
export interface BankParser {
  bankKey: string;
  senderIds: readonly string[];
  parse(raw: RawMessage): Transaction | "skip" | null;
}

export function directionOf(kind: TransactionKind): TransactionDirection {
  if (kind === "transfer_in" || kind === "deposit" || kind === "reversal") return "in";
  return "out";
}
