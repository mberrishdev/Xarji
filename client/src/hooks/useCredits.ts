import { useMemo } from "react";
import { db, type Credit } from "../lib/instant";
import { isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { useGelConverter } from "../lib/exchangeRates";
import type { MonthYear } from "./useMonthlyAnalytics";

export function useCredits() {
  const { data, isLoading, error } = db.useQuery({ credits: {} });

  const credits = useMemo(() => {
    if (!data?.credits) return [];
    return [...data.credits].sort((a, b) => b.transactionDate - a.transactionDate);
  }, [data?.credits]);

  return { credits, isLoading, error };
}

export type ConvertedCredit = Credit & { gelAmount: number | null };

export function useConvertedCredits() {
  const { credits, isLoading, error } = useCredits();
  const toGel = useGelConverter();
  const converted = useMemo<ConvertedCredit[]>(
    () => credits.map((c) => ({ ...c, gelAmount: toGel(c.amount, c.currency, c.transactionDate) })),
    [credits, toGel]
  );
  return { credits: converted, isLoading, error };
}

export function useMonthCredits(my: MonthYear) {
  const { credits } = useConvertedCredits();

  return useMemo(() => {
    const start = startOfMonth(new Date(my.year, my.month, 1));
    const end = endOfMonth(new Date(my.year, my.month, 1));
    const monthCredits = credits.filter((c) =>
      isWithinInterval(new Date(c.transactionDate), { start, end })
    );
    // `total` sums every currency converted to GEL; `count` reflects rows
    // that have actually contributed (i.e. either GEL or non-GEL with a
    // resolved rate). Rows still waiting on a rate are kept in `credits`
    // but excluded from the totals until the rate lands.
    let total = 0;
    let count = 0;
    for (const c of monthCredits) {
      if (c.gelAmount === null) continue;
      total += c.gelAmount;
      count += 1;
    }
    return { total, count, credits: monthCredits };
  }, [credits, my.month, my.year]);
}

export function useMonthCashflow(my: MonthYear, spendingTotal: number) {
  const income = useMonthCredits(my);
  return {
    income: income.total,
    spending: spendingTotal,
    net: income.total - spendingTotal,
    incomeCount: income.count,
  };
}
