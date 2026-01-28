import { cn } from "../../lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatsCard({ title, value, change, changeLabel, icon, className }: StatsCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 p-6", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {icon && (
          <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
            {icon}
          </div>
        )}
      </div>

      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>

      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {isPositive && (
            <>
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">
                +{change.toFixed(1)}%
              </span>
            </>
          )}
          {isNegative && (
            <>
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-600">
                {change.toFixed(1)}%
              </span>
            </>
          )}
          {!isPositive && !isNegative && (
            <>
              <Minus className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-400">0%</span>
            </>
          )}
          {changeLabel && (
            <span className="text-sm text-slate-500 ml-1">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
