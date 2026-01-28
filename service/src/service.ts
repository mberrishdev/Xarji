import { watch } from "fs";
import { MessagesDbReader } from "./db-reader";
import { parseMessages } from "./parser";
import { StateDb, ensureStateDbDir } from "./state-db";
import { syncAllTargets, initSyncTargets } from "./sync";
import { defaultConfig, type Config } from "./config";
import { closeInstantDB, isConnected as isInstantDBConnected } from "./instant-sync";

export class ExpenseTrackerService {
  private config: Config;
  private stateDb: StateDb | null = null;
  private watcher: ReturnType<typeof watch> | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private lastProcessTime = 0;
  private debounceMs = 2000; // Debounce file changes

  constructor(config: Config = defaultConfig) {
    this.config = config;
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    console.log("[Service] Initializing SMS Expense Tracker...");

    // Ensure state directory exists
    await ensureStateDbDir();

    // Initialize state database
    this.stateDb = new StateDb(this.config.stateDbPath);
    console.log("[Service] State database initialized");

    // Initialize sync targets (InstantDB, etc.)
    initSyncTargets(this.config);
  }

  /**
   * Process new messages from all configured senders
   */
  async processNewMessages(): Promise<number> {
    if (this.isProcessing) {
      console.log("[Service] Already processing, skipping...");
      return 0;
    }

    // Debounce rapid file changes
    const now = Date.now();
    if (now - this.lastProcessTime < this.debounceMs) {
      return 0;
    }

    this.isProcessing = true;
    this.lastProcessTime = now;
    let totalNewTransactions = 0;

    try {
      const reader = new MessagesDbReader(this.config.messagesDbPath);

      for (const senderId of this.config.bankSenderIds) {
        try {
          // Get last processed message ID
          const syncState = this.stateDb!.getSyncState(senderId);
          const lastMessageId = syncState?.lastMessageId ?? 0;

          console.log(`[Service] Checking ${senderId} (last ID: ${lastMessageId})`);

          // Get new messages since last sync
          const messages = reader.getMessagesSince(senderId, lastMessageId);

          if (messages.length === 0) {
            console.log(`[Service] No new messages from ${senderId}`);
            continue;
          }

          console.log(`[Service] Found ${messages.length} new messages from ${senderId}`);

          // Parse messages
          const { success, failed } = parseMessages(messages);

          console.log(
            `[Service] Parsed ${success.length} transactions, ${failed.length} failed`
          );

          // Filter out already processed transactions
          const newTransactions = success.filter(
            (tx) => !this.stateDb!.isProcessed(tx.id)
          );

          if (newTransactions.length === 0) {
            // Still update sync state even if no new transactions
            const maxMessageId = Math.max(...messages.map((m) => m.messageId));
            this.stateDb!.updateSyncState(senderId, maxMessageId);
            continue;
          }

          // Sync to all targets (local, webhook, InstantDB)
          const syncResults = await syncAllTargets(newTransactions, this.config, senderId);

          // Save to state database
          const synced = syncResults.instantdb.success || syncResults.webhook.success;
          for (const tx of newTransactions) {
            this.stateDb!.saveTransaction(tx, synced);
          }

          // Log sync results
          if (syncResults.instantdb.success && syncResults.instantdb.syncedCount) {
            console.log(`[Service] Synced ${syncResults.instantdb.syncedCount} to InstantDB`);
          }

          // Update sync state
          const maxMessageId = Math.max(...messages.map((m) => m.messageId));
          this.stateDb!.updateSyncState(senderId, maxMessageId);

          totalNewTransactions += newTransactions.length;

          console.log(
            `[Service] Processed ${newTransactions.length} new transactions from ${senderId}`
          );
        } catch (error) {
          console.error(`[Service] Error processing ${senderId}:`, error);
        }
      }

      reader.close();
    } catch (error) {
      console.error("[Service] Error in processNewMessages:", error);
    } finally {
      this.isProcessing = false;
    }

    return totalNewTransactions;
  }

  /**
   * Start watching for changes
   */
  startWatching(): void {
    console.log(`[Service] Starting file watcher for ${this.config.messagesDbPath}`);

    // Watch chat.db for changes
    try {
      this.watcher = watch(this.config.messagesDbPath, async (eventType) => {
        if (eventType === "change") {
          console.log("[Service] chat.db changed, processing...");
          await this.processNewMessages();
        }
      });

      console.log("[Service] File watcher started");
    } catch (error) {
      console.error("[Service] Failed to start file watcher:", error);
      console.log("[Service] Falling back to polling mode");
      this.startPolling();
    }
  }

  /**
   * Start polling mode (fallback)
   */
  startPolling(): void {
    console.log(
      `[Service] Starting polling mode (interval: ${this.config.pollIntervalMs}ms)`
    );

    this.pollInterval = setInterval(async () => {
      await this.processNewMessages();
    }, this.config.pollIntervalMs);
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    await this.init();

    // Process any existing messages first
    console.log("[Service] Running initial sync...");
    const count = await this.processNewMessages();
    console.log(`[Service] Initial sync complete: ${count} transactions`);

    // Start watching for changes
    this.startWatching();

    // Also start a fallback poll (less frequent) in case file watching misses something
    const fallbackInterval = this.config.pollIntervalMs * 5; // 5x slower than normal poll
    setInterval(async () => {
      await this.processNewMessages();
    }, fallbackInterval);

    console.log("[Service] SMS Expense Tracker service started");
    console.log(`[Service] Watching senders: ${this.config.bankSenderIds.join(", ")}`);
    console.log(`[Service] Local backup: ${this.config.localBackupPath}`);
    console.log(
      `[Service] InstantDB: ${this.config.instantdb.enabled ? "enabled" : "disabled"}`
    );
    console.log(
      `[Service] Webhook: ${this.config.webhook.enabled ? this.config.webhook.url : "disabled"}`
    );
  }

  /**
   * Stop the service
   */
  stop(): void {
    console.log("[Service] Stopping SMS Expense Tracker...");

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.stateDb) {
      this.stateDb.close();
      this.stateDb = null;
    }

    // Close InstantDB connection
    closeInstantDB();

    console.log("[Service] Service stopped");
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    transactionCount: number;
    lastSync: Date | null;
  } {
    const transactionCount = this.stateDb?.getTransactionCount() ?? 0;
    const syncState = this.stateDb?.getSyncState(this.config.bankSenderIds[0]);

    return {
      running: this.watcher !== null || this.pollInterval !== null,
      transactionCount,
      lastSync: syncState?.lastSyncAt ?? null,
    };
  }
}
