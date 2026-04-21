/**
 * Public parser façade.
 *
 * Historically all parsing logic lived here. It now delegates to
 * `./parsers/`, where each bank has its own isolated module. This file
 * preserves the original import surface (`parseMessage`, `parseMessages`,
 * `Transaction`, `TransactionType`, `TransactionStatus`, `ParseResult`,
 * `filterByStatus`) so existing callers (`service.ts`, `instant-sync.ts`,
 * `state-db.ts`, `sync.ts`, `cli.ts`) keep working unchanged.
 */

export type {
  Transaction,
  ParseResult,
  TransactionKind as TransactionType,
  TransactionStatus,
  TransactionDirection,
  BankParser,
} from "./parsers";

export {
  parseMessage,
  parseMessages,
  filterByStatus,
  getParserForSender,
  allBanks,
} from "./parsers";
