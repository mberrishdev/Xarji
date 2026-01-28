import { Modal, Badge, CategoryBadge, Button } from "../ui";
import { formatCurrency, formatDateTime, autoCategorize, DEFAULT_CATEGORIES } from "../../lib/utils";
import { CheckCircle, XCircle, CreditCard, Calendar, MessageSquare, Tag } from "lucide-react";
import type { Payment, FailedPayment } from "../../lib/instant";

type Transaction = (Payment & { status: "success" }) | (FailedPayment & { status: "failed"; amount: number | null });

interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

export function TransactionDetail({ transaction, onClose }: TransactionDetailProps) {
  const isSuccess = transaction.status === "success";
  const categoryName = autoCategorize(transaction.merchant);
  const category = DEFAULT_CATEGORIES.find((c) => c.name === categoryName) || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];

  return (
    <Modal open={true} onClose={onClose} title="Transaction Details" size="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              isSuccess ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {isSuccess ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {transaction.merchant || "Unknown Merchant"}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isSuccess ? "success" : "danger"}>
                {isSuccess ? "Successful" : "Failed"}
              </Badge>
              <CategoryBadge name={categoryName} color={category.color} />
            </div>
          </div>
          {isSuccess && (
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">
                -{formatCurrency(transaction.amount, transaction.currency)}
              </p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4 bg-slate-50 rounded-lg p-4">
          {/* Date */}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Date</p>
              <p className="text-sm font-medium text-slate-900">
                {formatDateTime(transaction.transactionDate)}
              </p>
            </div>
          </div>

          {/* Card */}
          {transaction.cardLastDigits && (
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Card</p>
                <p className="text-sm font-medium text-slate-900">
                  **** **** **** {transaction.cardLastDigits}
                </p>
              </div>
            </div>
          )}

          {/* Category */}
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Category</p>
              <p className="text-sm font-medium text-slate-900">{categoryName}</p>
            </div>
          </div>

          {/* Failure Reason (for failed payments) */}
          {!isSuccess && "failureReason" in transaction && transaction.failureReason && (
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Failure Reason</p>
                <p className="text-sm font-medium text-red-600">
                  {transaction.failureReason}
                </p>
              </div>
            </div>
          )}

          {/* Balance at time of failure */}
          {!isSuccess && "balance" in transaction && transaction.balance != null && (
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Balance at time</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatCurrency(transaction.balance as number, transaction.currency)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Raw Message */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Original Message
            </p>
          </div>
          <div className="bg-slate-100 rounded-lg p-3">
            <p className="text-xs text-slate-600 font-mono whitespace-pre-wrap break-all">
              {transaction.rawMessage}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
