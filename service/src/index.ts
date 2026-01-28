import { ExpenseTrackerService } from "./service";
import { loadConfig } from "./config";

const config = loadConfig();
const service = new ExpenseTrackerService(config);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Main] Received SIGINT, shutting down...");
  service.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Main] Received SIGTERM, shutting down...");
  service.stop();
  process.exit(0);
});

// Start the service
console.log("=".repeat(50));
console.log("ხარჯი — xarji service");
console.log("=".repeat(50));

await service.start();

// Keep the process running
console.log("\n[Main] Service is running. Press Ctrl+C to stop.\n");
