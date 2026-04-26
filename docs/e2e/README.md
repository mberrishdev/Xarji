# Manual E2E tests

Agent-driven smoke tests exercised in a real Chrome window via the Claude
chrome-MCP. Not in CI — run from the developer's machine, by an agent during
PR review and before any merge to `main`.

## When to run

| Scenario | What to run |
|---|---|
| Opening a PR for a focused feature/fix | Only the file(s) covering the surfaces the PR touches. e.g. a Dashboard-only change → `dashboard.md`. A range/dateRange change → every page file (range buttons live in every page header). |
| Pre-merge into `main` | Every file in this directory, top to bottom. The "we broke literally nothing" pass. |
| After a Codex review surfaces no-ship findings | Re-run the affected file(s) once the fix is pushed. |

The cadence is documented in `CLAUDE.md` §7.5 ("Manual E2E testing") so a
fresh session picks it up automatically.

## Prereqs

- `service` running on `127.0.0.1:8721` with at least one configured InstantDB
  app and some real transaction data already synced. The user's installed
  `Xarji.app` covers this on the dev machine — no need to start a dev service.
- `client` Vite dev server on `http://localhost:5173/`, started with
  `cd client && bun run dev`. Vite proxies `/api/*` to the running service.
- Chrome with the Claude extension connected. A fresh tab per session
  (don't reuse old tabs from other conversations).

## How an agent runs these

1. Pick the file(s) for the PR's surface.
2. For each test (each `### T-…` block), follow the **Steps** literally.
3. Compare against **Expected**. Anything that doesn't match is a regression
   — file it, fix it, push, re-run that test.
4. Where a test is marked `[unreliable on real data]`, note it in the PR
   review and skip — these are blocked on the demo-mode dataset (see
   `~/.claude/plans/now-i-want-to-distributed-zebra.md`). They become live
   once `?demo=1` lands.

## When to update this directory

Same PR that adds a UI surface adds a test for it. Same PR that removes a
surface removes the test. The discipline is the only thing that keeps these
docs honest — there's no CI pass to fail when they drift, only the next
manual run.

If you add a new page, create a new file: `docs/e2e/<page>.md`. Index it in
the table below so the pre-merge full-run is comprehensive.

## Test files

| File | Surface | Last verified |
|---|---|---|
| [dashboard.md](dashboard.md) | `client/src/pages/Dashboard.tsx` — hero card, donut, 9-month trend, top-merchant tiles | 2026-04-27 (PR #23) |
| [transactions.md](transactions.md) | `client/src/pages/Transactions.tsx` — filters, day groups, side panel, URL drill-down ingestion | 2026-04-27 (PR #23) |
| [categories.md](categories.md) | `client/src/pages/Categories.tsx` — left donut + list, per-cat detail, per-cat trend, merchant rows | 2026-04-27 (PR #23) |
| [merchants.md](merchants.md) | `client/src/pages/Merchants.tsx` — table, search, drill-down rows | 2026-04-27 (PR #23) |
| [income.md](income.md) | `client/src/pages/Income.tsx` — hero, income trend, ledger | 2026-04-27 (PR #23) |
| [ranges.md](ranges.md) | Cross-cutting `useRangeState` + `dateRange.ts` invariants and Codex-fix regressions | 2026-04-27 (PR #23) |

## Test ID convention

Each test has an ID `T-<AREA>-<NN>`:

- `AREA` = uppercase short tag: `DASH`, `TX`, `CAT`, `MERCH`, `INC`, `RANGE`.
- `NN` = two-digit zero-padded sequence within the file. Numbers don't get
  reused — if you delete a test, leave a gap (or repurpose the ID with a
  comment) so old PR references still make sense.

## Reporting a test result

When an agent reports a run, the format is:

```
T-DASH-01  ✓
T-DASH-02  ✗  expected donut tooltip "Food ₾340" but saw "Other ₾23,722"
T-DASH-03  ⊘  skipped — [unreliable on real data]
```

Pass / fail / skipped, with a one-line reason on fail.
