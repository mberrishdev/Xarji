/**
 * `bun run setup` entry point.
 *
 * The old implementation inlined both the prompt loop and the
 * persistence/bootstrap logic. Those now live in setup/schema.ts,
 * setup/apply.ts and setup/tui.ts so the same pieces can be reused
 * by the web onboarding wizard (served from http.ts). This file is
 * just the executable wrapper.
 */
import { runSetupTui } from "./setup/tui";

process.exit(await runSetupTui());
