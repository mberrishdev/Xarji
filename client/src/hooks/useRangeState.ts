// Shared range-button state for any page that renders the
// Today/Week/Month/Year/Custom switcher in PageHeader. Returns the
// derived DateRange + the props PageHeader needs (active/onRange/
// custom inputs). Pages stay one-liner thin.

import { useMemo, useState } from "react";
import { rangeFromKey, type DateRange, type RangeKey } from "../lib/dateRange";

export interface RangeStateProps {
  active: RangeKey;
  onRange: (key: string) => void;
  customStart: string;
  customEnd: string;
  onCustomChange: (start: string, end: string) => void;
}

export interface UseRangeStateResult {
  range: DateRange;
  props: RangeStateProps;
}

export function useRangeState(initial: RangeKey = "Month"): UseRangeStateResult {
  const [active, setActive] = useState<RangeKey>(initial);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // `now` is captured per render so the hooks downstream see a stable
  // input within a single React commit. Re-evaluating on every commit
  // is fine: the underlying data only changes when InstantDB pushes
  // an update, and the buckets snap to whatever "today" is then.
  const range = useMemo(
    () => rangeFromKey(active, new Date(), { start: customStart, end: customEnd }),
    [active, customStart, customEnd]
  );

  return {
    range,
    props: {
      active,
      onRange: (k) => setActive(k as RangeKey),
      customStart,
      customEnd,
      onCustomChange: (start, end) => {
        setCustomStart(start);
        setCustomEnd(end);
      },
    },
  };
}
