import { Card, CardHeader, CardTitle, CardContent, Select } from "../components/ui";
import { SpendingChart, CategoryPieChart, MerchantBarChart } from "../components/charts";
import {
  useAvailableMonths,
  useMonthStats,
  useMonthSpendingByDay,
  useMonthTopMerchants,
  useMonthCategoryAnalytics,
} from "../hooks/useMonthlyAnalytics";
import { formatCurrency } from "../lib/utils";
import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function Analytics() {
  const availableMonths = useAvailableMonths();

  // Default to current month
  const defaultMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const monthYear = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return { month, year };
  }, [selectedMonth]);

  const stats = useMonthStats(monthYear);
  const spendingByDay = useMonthSpendingByDay(monthYear);
  const topMerchants = useMonthTopMerchants(monthYear, 10);
  const { withPercentages: categoryData, totalSpent } = useMonthCategoryAnalytics(monthYear);

  const monthOptions = useMemo(() => {
    const options = availableMonths.map((m) => ({ value: m.value, label: m.label }));
    // Ensure current month is always an option
    if (!options.find((o) => o.value === defaultMonth)) {
      const now = new Date();
      options.unshift({
        value: defaultMonth,
        label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      });
    }
    return options;
  }, [availableMonths, defaultMonth]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monthly insights into your spending patterns
          </p>
        </div>
        <div className="w-48">
          <Select
            options={monthOptions}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Previous Month Comparison Banner */}
      {stats.prevTotal > 0 && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            stats.totalChange <= 0
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {stats.totalChange <= 0 ? (
            <TrendingDown className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <TrendingUp className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p
            className={`text-sm ${
              stats.totalChange <= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {stats.totalChange <= 0 ? "Down" : "Up"}{" "}
            <strong>{Math.abs(stats.totalChange).toFixed(1)}%</strong> compared to
            previous month ({formatCurrency(stats.prevTotal)}).
            {stats.countChange !== 0 && (
              <> Transaction count {stats.countChange > 0 ? "up" : "down"}{" "}
              {Math.abs(stats.countChange).toFixed(1)}%.</>
            )}
          </p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-slate-500">Total Spent</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(totalSpent)}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">Transactions</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.count}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">Failed</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.failedCount}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">Avg per Transaction</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(stats.avg)}
          </p>
        </Card>
      </div>

      {/* Spending Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendingChart data={spendingByDay} height={350} />
        </CardContent>
      </Card>

      {/* Category and Merchant Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <>
                <CategoryPieChart data={categoryData} height={300} showLegend={false} />
                <div className="mt-4 space-y-2">
                  {categoryData.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-sm text-slate-700">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-slate-900">
                          {formatCurrency(cat.total)}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({cat.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-slate-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Merchants */}
        <Card>
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {topMerchants.length > 0 ? (
              <MerchantBarChart data={topMerchants} height={400} />
            ) : (
              <div className="flex items-center justify-center h-[400px] text-sm text-slate-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
