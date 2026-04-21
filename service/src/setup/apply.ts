/**
 * applySetup(values) — the persistence + bootstrap step shared by the
 * terminal wizard (`bun run setup`) and the POST /api/setup handler.
 *
 * Takes a schema-validated FieldMap and:
 *   1. Writes ~/.xarji/config.json
 *   2. Writes service/.env and client/.env (for dev-mode runs)
 *   3. Initialises ~/.xarji/state.db
 *   4. Bootstraps the InstantDB app: schemaless pass to create attrs,
 *      schema-backed pass to register unique/indexed metadata
 *
 * Any step can fail; the return value reports the failure and the
 * partial progress so callers can show useful diagnostics.
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { init, id } from "@instantdb/admin";
import schema from "../instant-schema";
import { StateDb, ensureStateDbDir } from "../state-db";
import { validateAll, type FieldMap } from "./schema";

const HOME = homedir();
const CONFIG_DIR = join(HOME, ".xarji");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const SERVICE_DIR = resolve(import.meta.dir, "..", "..");
const CLIENT_DIR = resolve(SERVICE_DIR, "..", "client");

export type ApplyStep =
  | "validate"
  | "config"
  | "env"
  | "state-db"
  | "bootstrap-attrs"
  | "bootstrap-schema";

export interface ApplyProgress {
  step: ApplyStep;
  ok: boolean;
  message?: string;
}

export interface ApplyResult {
  ok: boolean;
  completed: ApplyStep[];
  failedAt?: ApplyStep;
  error?: string;
  /** Errors keyed by field id when validation fails. */
  fieldErrors?: Record<string, string>;
}

export interface ApplyOptions {
  /** Called as each step completes (or fails) so callers can stream progress. */
  onProgress?: (p: ApplyProgress) => void | Promise<void>;
}

interface ExtractedValues {
  appId: string;
  adminToken: string;
  bankSenderIds: string[];
}

function extract(values: FieldMap): ExtractedValues {
  return {
    appId: String(values.instantAppId ?? "").trim(),
    adminToken: String(values.instantAdminToken ?? "").trim(),
    bankSenderIds: (values.bankSenderIds as string[]).map((s) => s.trim()).filter(Boolean),
  };
}

/** Seed rows written during the bootstrap pass to force attribute creation. */
function bootstrapSeed(): Array<{ table: string; data: Record<string, unknown> }> {
  const now = Date.now();
  return [
    {
      table: "payments",
      data: {
        transactionId: "xarji-setup-test",
        transactionType: "payment",
        amount: 0,
        currency: "GEL",
        merchant: "Schema Test",
        cardLastDigits: "0000",
        transactionDate: now,
        messageTimestamp: now,
        syncedAt: now,
        plusEarned: 0,
        plusTotal: 0,
        bankSenderId: "TEST",
        rawMessage: "Setup schema push",
      },
    },
    {
      table: "failedPayments",
      data: {
        transactionId: "xarji-setup-test-failed",
        transactionType: "payment_failed",
        currency: "GEL",
        merchant: "Schema Test",
        cardLastDigits: "0000",
        failureReason: "setup-bootstrap",
        balance: 0,
        transactionDate: now,
        messageTimestamp: now,
        syncedAt: now,
        bankSenderId: "TEST",
        rawMessage: "Setup schema push (failed)",
      },
    },
    {
      table: "categories",
      data: {
        name: "__setup__",
        color: "#000000",
        icon: "·",
        isDefault: false,
      },
    },
    {
      table: "bankSenders",
      data: {
        senderId: "__SETUP__",
        displayName: "Setup Bootstrap",
        enabled: false,
        createdAt: now,
      },
    },
    {
      table: "credits",
      data: {
        transactionId: "xarji-setup-test-credit",
        transactionType: "transfer_in",
        amount: 0,
        currency: "GEL",
        counterparty: "Schema Test",
        cardLastDigits: "0000",
        transactionDate: now,
        messageTimestamp: now,
        syncedAt: now,
        bankSenderId: "TEST",
        rawMessage: "Setup schema push (credit)",
      },
    },
  ];
}

export async function applySetup(
  values: FieldMap,
  opts: ApplyOptions = {}
): Promise<ApplyResult> {
  const report = async (step: ApplyStep, ok: boolean, message?: string) => {
    await opts.onProgress?.({ step, ok, message });
  };

  // 1. Validate
  const fieldErrors = validateAll(values);
  if (Object.keys(fieldErrors).length > 0) {
    await report("validate", false, "Invalid field values");
    return {
      ok: false,
      completed: [],
      failedAt: "validate",
      error: "Invalid field values",
      fieldErrors,
    };
  }
  await report("validate", true);

  const { appId, adminToken, bankSenderIds } = extract(values);
  const completed: ApplyStep[] = ["validate"];

  // 2. Write ~/.xarji/config.json
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    const config = {
      bankSenderIds,
      messagesDbPath: join(HOME, "Library", "Messages", "chat.db"),
      stateDbPath: join(CONFIG_DIR, "state.db"),
      localBackupPath: join(CONFIG_DIR, "transactions.json"),
      instantdb: { enabled: true, appId, adminToken },
      webhook: { enabled: false, url: "" },
      pollIntervalMs: 60000,
    };
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    completed.push("config");
    await report("config", true);
  } catch (err) {
    await report("config", false, String(err));
    return { ok: false, completed, failedAt: "config", error: String(err) };
  }

  // 3. Write .env files — best-effort, don't hard-fail the whole setup
  try {
    await writeFile(
      join(SERVICE_DIR, ".env"),
      `INSTANT_APP_ID=${appId}\nINSTANT_ADMIN_TOKEN=${adminToken}\n`
    );
    await writeFile(
      join(CLIENT_DIR, ".env"),
      `VITE_INSTANT_APP_ID=${appId}\n`
    ).catch(() => {
      // CLIENT_DIR may not exist in a compiled-binary install; that's fine.
    });
    completed.push("env");
    await report("env", true);
  } catch (err) {
    // Non-fatal: dev-mode convenience files failing doesn't block a real
    // install, since the runtime reads ~/.xarji/config.json directly.
    await report("env", false, String(err));
  }

  // 4. Initialise state.db
  try {
    await ensureStateDbDir();
    const stateDb = new StateDb();
    stateDb.close();
    completed.push("state-db");
    await report("state-db", true);
  } catch (err) {
    await report("state-db", false, String(err));
    return { ok: false, completed, failedAt: "state-db", error: String(err) };
  }

  // 5a. Bootstrap attributes without schema. `@instantdb/admin` sets
  //     `throw-on-missing-attrs?` when initialised with a schema, so a
  //     brand-new app needs this schemaless pass to auto-create attrs.
  try {
    const bootstrapDb = init({ appId, adminToken });
    for (const { table, data } of bootstrapSeed()) {
      const rowId = id();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = (bootstrapDb.tx as any)[table][rowId];
      await bootstrapDb.transact(tx.update(data));
      await bootstrapDb.transact(tx.delete());
    }
    completed.push("bootstrap-attrs");
    await report("bootstrap-attrs", true);
  } catch (err) {
    await report("bootstrap-attrs", false, String(err));
    return { ok: false, completed, failedAt: "bootstrap-attrs", error: String(err) };
  }

  // 5b. Second pass with the schema applied so uniqueness + indexes
  //     register on the now-existing attributes.
  try {
    const schemaDb = init({ appId, adminToken, schema });
    for (const { table, data } of bootstrapSeed()) {
      const rowId = id();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = (schemaDb.tx as any)[table][rowId];
      await schemaDb.transact(tx.update(data));
      await schemaDb.transact(tx.delete());
    }
    completed.push("bootstrap-schema");
    await report("bootstrap-schema", true);
  } catch (err) {
    await report("bootstrap-schema", false, String(err));
    return { ok: false, completed, failedAt: "bootstrap-schema", error: String(err) };
  }

  return { ok: true, completed };
}
