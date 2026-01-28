/**
 * Push schema to InstantDB
 * Run: bun run src/push-schema.ts
 */

import { init, id } from "@instantdb/admin";
import schema from "./instant-schema";
import { loadConfig } from "./config";

const config = loadConfig();

if (!config.instantdb.enabled || !config.instantdb.appId || !config.instantdb.adminToken) {
  console.error("InstantDB not configured. Run: bun run src/cli.ts install");
  process.exit(1);
}

console.log("Pushing schema to InstantDB...");
console.log("App ID:", config.instantdb.appId);

const db = init({
  appId: config.instantdb.appId,
  adminToken: config.instantdb.adminToken,
  schema,
});

// Create a test record to ensure schema is applied
try {
  const testId = id();

  // Try to create a test payment
  await db.transact(
    db.tx.payments[testId].update({
      transactionId: "test-schema-push",
      transactionType: "payment",
      amount: 0,
      currency: "GEL",
      merchant: "Schema Test",
      cardLastDigits: "0000",
      transactionDate: Date.now(),
      messageTimestamp: Date.now(),
      syncedAt: Date.now(),
      plusEarned: 0,
      plusTotal: 0,
      bankSenderId: "TEST",
      rawMessage: "Schema push test",
    })
  );

  // Delete the test record
  await db.transact(db.tx.payments[testId].delete());

  console.log("✓ Schema pushed successfully!");
  console.log("\nTables created:");
  console.log("  - payments (for successful transactions)");
  console.log("  - failedPayments (for failed transactions)");
} catch (error) {
  console.error("Error pushing schema:", error);
  process.exit(1);
}
