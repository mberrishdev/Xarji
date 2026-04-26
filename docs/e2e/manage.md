# Manage — manual E2E

Surface: `client/src/pages/Settings.tsx`, mounted at `/manage` (`/settings` → 301 redirect).

**Demo mode required.** Confirm via Prereqs in `README.md` before running.

Open `http://localhost:5173/manage`.

This page is the catch-all for "things I configure": data sources (bank
senders, sync), categories, AI assistant, theme tweaks, danger zone.
Most subsections are independent; tests are scoped per section.

---

## Sync now button (PR #22)

### T-MGT-01 — Sync button renders + idle hint

**Steps**
1. Navigate to `/manage`.
2. Scroll to "Data sources" card.
3. Find the "Sync now" row.

**Expected**
- Row visible with label "Sync now" and hint "Re-read chat.db and push any new messages".
- Right side shows a "Sync" button (not "Syncing…").
- Button has cursor: pointer on hover.

### T-MGT-02 — Sync button success path (real service required)

**Pre:** the bun service must be running on `:8721`. Demo mode does NOT exercise the real sync code path — `/api/sync` hits the actual service which reads chat.db.

**Steps**
1. Click "Sync".

**Expected**
- Button text changes to "Syncing…", cursor goes to default, opacity drops to 0.7.
- After ~100ms-2s (depends on chat.db size) button reverts to "Sync".
- Hint updates to "Last sync: N new transaction(s)" where N is the count of new messages parsed AND successfully delivered to all enabled targets.
- If N = 1, label uses singular ("transaction"), otherwise plural ("transactions").

### T-MGT-03 — Sync button error path (service down)

**Steps**
1. With the bun service stopped (or run in demo mode where the proxy will 502), click "Sync".

**Expected**
- Hint updates to "Sync failed: <message>" — e.g. "Sync failed: HTTP 503" if the service responded "Service not running", or a network-error string if the proxy itself failed.
- Button reverts to "Sync" (not stuck in "Syncing…").

### T-MGT-04 — Partial-failure UI state

**Pre:** difficult to reproduce on demand without breaking InstantDB or webhook. To exercise: temporarily set `~/.xarji/config.json`'s `instantdb.appId` to a bogus value, restart the service, click Sync.

**Expected**
- Hint reads "Synced 0, 1 target failed (instantdb). Will retry on next sync."
- A subsequent Sync click after fixing the config should retry the same messages and succeed.
- This pins the Codex HIGH fix from PR #22 — cursor must NOT advance through a failed batch, otherwise messages are silently lost.

### T-MGT-05 — CSRF rejection on `/api/sync`

**Pre:** the bun service must be running. This test runs from the terminal, not Chrome.

**Steps**
1. From a terminal run:
   ```sh
   curl -sS -X POST http://127.0.0.1:8721/api/sync -H 'Origin: http://evil.example' -i | head -3
   ```
2. Then with no Origin at all:
   ```sh
   curl -sS -X POST http://127.0.0.1:8721/api/sync -i | head -3
   ```
3. Then with the dashboard's own Origin:
   ```sh
   curl -sS -X POST http://127.0.0.1:8721/api/sync -H 'Origin: http://127.0.0.1:8721' -i | head -3
   ```

**Expected**
- (1) HTTP 403 with body `{"error":"Forbidden: cross-origin request"}`.
- (2) HTTP 403 with body `{"error":"Forbidden: missing Origin"}` (or "Forbidden: malformed Referer" if curl auto-sets one).
- (3) HTTP 200 with body `{"synced":N,"failures":[...]}` (the normal success path).

This pins the CSRF protection added in PR #22.

---

## Other Settings sections

(Placeholder — when Categories management, AI Assistant, Bank Senders, or Danger Zone get touched, add T-MGT-xx tests here covering those flows.)
