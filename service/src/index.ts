import { ExpenseTrackerService } from "./service";
import { isConfigured, loadConfig } from "./config";
import { startHttpServer, type HttpServerHandle } from "./http";

const DEFAULT_PORT = Number(process.env.XARJI_PORT ?? 8721);

const config = loadConfig();
// Treat the install as configured when either a config file exists OR
// INSTANT_APP_ID + INSTANT_ADMIN_TOKEN are set in the environment. The
// latter keeps pre-existing env-driven deployments working — before this
// check they were stuck permanently in onboarding mode.
const configured = isConfigured();

let service: ExpenseTrackerService | null = null;
let http: HttpServerHandle | null = null;

async function shutdown(signal: string) {
  console.log(`\n[Main] Received ${signal}, shutting down...`);
  service?.stop();
  http?.stop();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("=".repeat(50));
console.log("ხარჯი — xarji service");
console.log("=".repeat(50));

// HTTP comes up first and always. The dashboard is reachable the moment
// the binary starts, even before the user has entered their InstantDB
// credentials — that's what gives the onboarding wizard (PR 2) somewhere
// to live.
if (configured) {
  service = new ExpenseTrackerService(config);
}

http = startHttpServer({
  port: DEFAULT_PORT,
  config,
  service,
  configured,
});

if (service) {
  await service.start();
  console.log("\n[Main] Service is running. Press Ctrl+C to stop.");
} else {
  console.log("\n[Main] No configuration yet (neither ~/.xarji/config.json nor INSTANT_APP_ID/INSTANT_ADMIN_TOKEN env vars are set).");
  console.log(`[Main] Open ${http.url} to finish setup.`);
  console.log("[Main] Press Ctrl+C to stop.\n");
}
