// Shared date-range model the page-header range buttons drive. Aggregator
// hooks (useRangeStats, useRangeCredits, useRangeTopMerchants) consume
// `DateRange` directly so a button change re-runs the right slice of the
// transactions list with no per-hook special-casing.
//
// "Custom" is a placeholder until the user sets explicit start/end dates
// via the inline date inputs in PageHeader; before they do, it falls back
// to the last 30 days so the UI never shows a blank screen.

import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  format,
} from "date-fns";

export type RangeKey = "Today" | "Week" | "Month" | "Year" | "Custom";

export const RANGE_OPTIONS: RangeKey[] = ["Today", "Week", "Month", "Year", "Custom"];

export interface DateRange {
  /** Inclusive start, local time. */
  start: Date;
  /** Inclusive end, local time. */
  end: Date;
  /** "April 2026", "Apr 1 – 26", etc. — used for chart subtitles + tooltips. */
  label: string;
  /** Which named range this came from. "Custom" means the user picked a
   *  bespoke window via the date inputs. */
  key: RangeKey;
}

export interface CustomRange {
  start: string; // YYYY-MM-DD
  end: string;
}

/** Build a DateRange from the active button + optional custom dates.
 *  `now` is injected so tests / per-page mounts compute against the
 *  same instant for the lifetime of a render. */
export function rangeFromKey(key: RangeKey, now: Date, custom?: CustomRange): DateRange {
  switch (key) {
    case "Today": {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return { start, end, label: format(start, "MMMM d, yyyy"), key };
    }
    case "Week": {
      // Calendar week starting Monday — matches the convention most
      // Georgian users expect (Sunday-start would push half the
      // weekend into the next bucket).
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return { start, end, label: `${format(start, "MMM d")} – ${format(end, "MMM d")}`, key };
    }
    case "Month": {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return { start, end, label: format(start, "MMMM yyyy"), key };
    }
    case "Year": {
      const start = startOfYear(now);
      const end = endOfYear(now);
      return { start, end, label: format(start, "yyyy"), key };
    }
    case "Custom": {
      if (custom?.start && custom?.end) {
        const start = startOfDay(new Date(custom.start));
        const end = endOfDay(new Date(custom.end));
        return { start, end, label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`, key };
      }
      // Fallback while the user hasn't set explicit dates yet.
      const start = startOfDay(subDays(now, 29));
      const end = endOfDay(now);
      return { start, end, label: "Last 30 days", key };
    }
  }
}

export function isInRange(ts: number, range: DateRange): boolean {
  return ts >= range.start.getTime() && ts <= range.end.getTime();
}

/** Returns the equivalent range shifted back by one period — used for
 *  the "vs. previous period" comparison labels in tooltips and stat
 *  cards. */
export function previousRange(range: DateRange): DateRange {
  const span = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  // Anchor the comparison label to the same shape as the source.
  switch (range.key) {
    case "Today":
      return { start: startOfDay(prevStart), end: endOfDay(prevStart), label: format(prevStart, "MMM d, yyyy"), key: "Today" };
    case "Week":
      return { start: startOfWeek(prevStart, { weekStartsOn: 1 }), end: endOfWeek(prevStart, { weekStartsOn: 1 }), label: `${format(prevStart, "MMM d")} – ${format(prevEnd, "MMM d")}`, key: "Week" };
    case "Month":
      return { start: startOfMonth(prevStart), end: endOfMonth(prevStart), label: format(prevStart, "MMMM yyyy"), key: "Month" };
    case "Year":
      return { start: startOfYear(prevStart), end: endOfYear(prevStart), label: format(prevStart, "yyyy"), key: "Year" };
    case "Custom":
    default:
      return { start: prevStart, end: prevEnd, label: `${format(prevStart, "MMM d")} – ${format(prevEnd, "MMM d, yyyy")}`, key: "Custom" };
  }
}
