# Dashboard — manual E2E

Surface: `client/src/pages/Dashboard.tsx` and the hooks it consumes.

Open `http://localhost:5173/`. Default range: **Month**.

---

## T-DASH-01 — Page loads with Month-scope hero

**Steps**
1. Navigate to `http://localhost:5173/`.
2. Wait for the dashboard to render.

**Expected**
- Eyebrow shows `Good morning|afternoon|evening` (depending on local hour).
- Title shows `<current month name> <year>, at a glance` (e.g. `April 2026, at a glance`).
- Range buttons visible top-right: **Today / Week / Month / Year / Custom** with **Month** highlighted.
- Hero card shows "OUTGOING · <month label>" eyebrow and a non-zero "You spent" figure if there are payments this month.
- Subline reads `<delta vs prev period> · <N> days · <count> transactions` where `<N>` is the count of days from the start of the active range up to today (capped at the range length).
- Spending mix card renders the donut and a category list.
- Today & recent card lists transactions newest-first.
- Top merchants card shows tiles with `<category color> <category name>` / `<merchant>` / `₾<total>` / `×<count>`.

---

## T-DASH-02 — Range buttons re-scope every widget

**Steps**
1. From Month view, click **Week**.
2. Click **Year**.
3. Click **Custom**, then set `From` and `To` date inputs to a known window (e.g. last 30 days).
4. Click **Today**.
5. Click **Month** to return.

**Expected (each step)**
- Eyebrow on the hero card updates: e.g. Week → "OUTGOING · APR 27 – MAY 3", Year → "OUTGOING · 2026", Custom → "OUTGOING · APR <m> – APR <n>", Today → "OUTGOING · April 27, 2026".
- Page title updates: "Week of …, at a glance" / "2026, at a glance" / "<from – to>, at a glance" / "April 27, 2026, at a glance".
- "You spent" figure recomputes for the new window (Week may show ₾0 if no spending today).
- Subline `<N> days` matches the active range length capped at days elapsed (e.g. Week shows up to 7, Today shows 1).
- Donut center label matches the range (e.g. Year → "2026", Month → "APR", Today → date label).
- Top merchants title reads "Top merchants · <range.label>".
- Custom button: when active, two `<input type="date">` controls render inline in the header.

---

## T-DASH-03 — Hero "vs prior period" delta

**Steps**
1. With **Month** active, observe the pill in the top-right of the hero card.
2. Switch to **Year** and re-observe.

**Expected**
- Pill shows `↑ X.X% vs <prev period short label>` (or `↓` if down). Color: accent (coral) for an increase in spending, green for a decrease.
- Subline `+₾<delta> more|less than <prev period name>` matches the pill's direction.
- For Year view, "vs 2025" should appear in the pill if there's data for 2025.

---

## T-DASH-04 — AreaChart hover tooltip (9-month trend)

**Steps**
1. Hover the area chart at the bottom of the hero card.
2. Move the cursor across multiple month buckets.

**Expected**
- A tooltip appears anchored to the active bucket, showing:
  - bucket label (e.g. `NOV`)
  - current value formatted `₾<value>`
  - if a prior bucket exists in the series: `vs <prev label> ₾<prev value> ±X%`
- Delta uses **green** for an increase (current > prior), **accent (coral)** for a decrease.
- Active dot draws a white-filled circle with a 1.5px stroke at the hovered point.
- Tooltip background, border, and font follow the active theme (toggle dark/light via the tweaks panel — the tooltip should track).

---

## T-DASH-05 — AreaChart click drill-down

**Steps**
1. Click the area chart on a visible month (e.g. November).

**Expected**
- URL changes to `/transactions?dateFrom=YYYY-MM-01&dateTo=YYYY-MM-DD` where the dates bound the clicked month.
- Transactions page renders with **Custom** range highlighted; the date inputs in the header show the same window.
- Transactions list contains only entries from that month.

---

## T-DASH-06 — Donut hover tooltip

**Steps**
1. Hover the spending-mix donut on a colored ring segment.

**Expected**
- A tooltip appears showing:
  - color dot
  - segment name (e.g. `Food`, or `Other` if the categorizer didn't match)
  - `₾<value>` (rounded)
  - `<X.X>% of total`
- Tooltip background follows the active theme.
- `[unreliable on real data]` — on the developer's installed app, every transaction lands in `Other` because the categorizer doesn't match Georgian merchants. Multi-segment hover can't be exercised until demo mode lands.

---

## T-DASH-07 — Donut click drill-down propagates active range

**Steps**
1. With **Month** active, click any donut segment.
2. Navigate back, switch to **Year**, click any donut segment.
3. Navigate back, switch to **Custom** with a known `dateFrom`/`dateTo`, click any donut segment.

**Expected (each)**
- URL changes to `/transactions?category=<id>&dateFrom=<X>&dateTo=<Y>` where:
  - `<id>` is the clicked segment's category id.
  - `<X>`/`<Y>` reflect the **source page's active range**, NOT a hardcoded month. Year click → `2026-01-01`/`2026-12-31`. Custom click → the picked custom dates.
- Transactions page lands with **Custom** range highlighted (because it received explicit dates) and category filter pre-selected.
- Transactions list reflects both filters.

This test pins **Codex HIGH fix** from PR #23 (`c214df0`).

---

## T-DASH-08 — Donut center / hole click is a no-op

**Steps**
1. Click the empty center hole of the donut (inside the inner radius).

**Expected**
- No navigation. URL stays at `/`.

The donut is a snapshot widget when there's nothing to drill into; only ring clicks navigate.

---

## T-DASH-09 — Top merchant tile drill-down

**Steps**
1. Scroll to "Top merchants · <range.label>" card at the bottom.
2. Click any merchant tile.

**Expected**
- URL changes to `/transactions?merchant=<merchant-name-encoded>&dateFrom=<X>&dateTo=<Y>` where dates reflect the source page's active range.
- Transactions page renders with the merchant search box pre-filled and the **Custom** range showing the source window.

---

## T-DASH-10 — Income / Net cashflow side cards

**Steps**
1. Look at the right column on the hero row.
2. Switch ranges and re-observe.

**Expected**
- Income card shows `+₾<total>`, a top-credits list (up to 5), and a `±X% vs <prev period>` pill.
- Net cashflow card shows `±₾<delta>` and `<X>% saved|overspent` based on income vs spent.
- Both cards re-scope to whatever range is active.

---

## T-DASH-11 — Loading / empty states

**Steps**
1. Switch to **Today** when there have been no transactions today.
2. Switch to **Custom** with `From` and `To` set to the same future date.

**Expected**
- "You spent ₾0", "0 transactions", subline shows the day count for the range.
- Spending mix card shows "No spending data yet."
- Today & recent shows whatever existing recent activity (this card isn't range-scoped).
