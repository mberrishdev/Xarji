import { init, id } from "@instantdb/admin";
import schema from "./instant-schema";
import type { Config } from "./config";
import type { Transaction } from "./parser";

export interface InstantSyncResult {
  success: boolean;
  syncedCount: number;
  paymentsCount: number;
  failedPaymentsCount: number;
  error?: string;
}

let db: ReturnType<typeof init<typeof schema>> | null = null;

/**
 * Initialize InstantDB connection
 */
export function initInstantDB(config: Config["instantdb"]): boolean {
  if (!config.enabled) {
    console.log("[InstantDB] Sync disabled");
    return false;
  }

  if (!config.appId || !config.adminToken) {
    console.error("[InstantDB] Missing appId or adminToken");
    return false;
  }

  try {
    db = init({
      appId: config.appId,
      adminToken: config.adminToken,
      schema,
    });
    console.log("[InstantDB] Initialized successfully");
    return true;
  } catch (error) {
    console.error("[InstantDB] Failed to initialize:", error);
    return false;
  }
}

/**
 * Sync transactions to InstantDB - routes to correct table based on status
 */
export async function syncTransactions(
  transactions: Transaction[],
  bankSenderId: string
): Promise<InstantSyncResult> {
  if (!db) {
    return { success: false, syncedCount: 0, paymentsCount: 0, failedPaymentsCount: 0, error: "InstantDB not initialized" };
  }

  if (transactions.length === 0) {
    return { success: true, syncedCount: 0, paymentsCount: 0, failedPaymentsCount: 0 };
  }

  try {
    const now = Date.now();
    const operations: any[] = [];

    // Separate by status
    const successfulPayments = transactions.filter(tx => tx.status === "success");
    const failedPayments = transactions.filter(tx => tx.status === "failed");

    // Build operations for successful payments
    for (const tx of successfulPayments) {
      const txId = id();
      operations.push(
        db.tx.payments[txId].update({
          transactionId: tx.id,
          transactionType: tx.transactionType,
          amount: tx.amount!,
          currency: tx.currency,
          merchant: tx.merchant,
          cardLastDigits: tx.cardLastDigits,
          transactionDate: tx.transactionDate.getTime(),
          messageTimestamp: tx.messageTimestamp.getTime(),
          syncedAt: now,
          plusEarned: tx.plusEarned,
          plusTotal: tx.plusTotal,
          bankSenderId,
          rawMessage: tx.rawMessage,
        })
      );
    }

    // Build operations for failed payments
    for (const tx of failedPayments) {
      const txId = id();
      operations.push(
        db.tx.failedPayments[txId].update({
          transactionId: tx.id,
          transactionType: tx.transactionType,
          currency: tx.currency,
          merchant: tx.merchant,
          cardLastDigits: tx.cardLastDigits,
          failureReason: tx.failureReason,
          balance: tx.balance,
          transactionDate: tx.transactionDate.getTime(),
          messageTimestamp: tx.messageTimestamp.getTime(),
          syncedAt: now,
          bankSenderId,
          rawMessage: tx.rawMessage,
        })
      );
    }

    // Execute all operations
    if (operations.length > 0) {
      await db.transact(operations);
    }

    console.log(`[InstantDB] Synced ${successfulPayments.length} payments, ${failedPayments.length} failed payments`);
    return {
      success: true,
      syncedCount: transactions.length,
      paymentsCount: successfulPayments.length,
      failedPaymentsCount: failedPayments.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[InstantDB] Batch sync error:", message);
    return { success: false, syncedCount: 0, paymentsCount: 0, failedPaymentsCount: 0, error: message };
  }
}

/**
 * Query payments from InstantDB
 */
export async function queryPayments(options?: {
  limit?: number;
  currency?: string;
  merchant?: string;
}): Promise<{ payments: any[]; error?: string }> {
  if (!db) {
    return { payments: [], error: "InstantDB not initialized" };
  }

  try {
    const whereClause: Record<string, any> = {};
    if (options?.currency) whereClause.currency = options.currency;
    if (options?.merchant) whereClause.merchant = options.merchant;

    const result = await db.query({
      payments: {
        $: {
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          limit: options?.limit || 100,
        },
      },
    });

    return { payments: result.payments || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { payments: [], error: message };
  }
}

/**
 * Query failed payments from InstantDB
 */
export async function queryFailedPayments(options?: {
  limit?: number;
}): Promise<{ failedPayments: any[]; error?: string }> {
  if (!db) {
    return { failedPayments: [], error: "InstantDB not initialized" };
  }

  try {
    const result = await db.query({
      failedPayments: {
        $: {
          limit: options?.limit || 100,
        },
      },
    });

    return { failedPayments: result.failedPayments || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { failedPayments: [], error: message };
  }
}

/**
 * Check if InstantDB is connected
 */
export function isConnected(): boolean {
  return db !== null;
}

/**
 * Close InstantDB connection
 */
export function closeInstantDB(): void {
  db = null;
  console.log("[InstantDB] Connection closed");
}
