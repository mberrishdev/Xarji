import { cn, formatCurrency, formatRelativeDate, autoCategorize } from "../../lib/utils";
import { Badge, CategoryBadge } from "../ui";
import { CheckCircle, XCircle, CreditCard } from "lucide-react";
import type { Payment, FailedPayment } from "../../lib/instant";
import { DEFAULT_CATEGORIES } from "../../lib/utils";

type Transaction = (Payment & { status: "success" }) | (FailedPayment & { status: "failed"; amount: number | null });

interface TransactionRowProps {
  transaction: Transaction;
  onClick?: () => void;
}

export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const isSuccess = transaction.status === "success";
  const categoryName = autoCategorize(transaction.merchant);
  const category = DEFAULT_CATEGORIES.find((c) => c.name === categoryName) || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer",
        !isSuccess && "bg-red-50/50"
      )}
      onClick={onClick}
    >
      {/* Status Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          isSuccess ? "bg-green-100" : "bg-red-100"
        )}
      >
        {isSuccess ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600" />
        )}
      </div>

      {/* Merchant & Category */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {transaction.merchant || "Unknown Merchant"}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <CategoryBadge name={categoryName} color={category.color} size="sm" />
          {transaction.cardLastDigits && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              ****{transaction.cardLastDigits}
            </span>
          )}
        </div>
      </div>

      {/* Amount & Date */}
      <div className="flex-shrink-0 text-right">
        {isSuccess ? (
          <p className="text-sm font-semibold text-slate-900">
            -{formatCurrency(transaction.amount, transaction.currency)}
          </p>
        ) : (
          <Badge variant="danger" size="sm">Failed</Badge>
        )}
        <p className="text-xs text-slate-500 mt-1">
          {formatRelativeDate(transaction.transactionDate)}
        </p>
      </div>
    </div>
  );
}
