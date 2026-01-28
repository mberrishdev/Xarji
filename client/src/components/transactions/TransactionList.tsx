import { useState } from "react";
import { TransactionRow } from "./TransactionRow";
import { TransactionDetail } from "./TransactionDetail";
import { EmptyState, Loading } from "../ui";
import { Receipt } from "lucide-react";
import type { Payment, FailedPayment } from "../../lib/instant";

export type Transaction = (Payment & { status: "success" }) | (FailedPayment & { status: "failed"; amount: number | null });

interface TransactionListProps {
  transactions: Transaction[];
  groupedByDate?: Record<string, Transaction[]>;
  isLoading?: boolean;
  showDateGroups?: boolean;
}

export function TransactionList({
  transactions,
  groupedByDate,
  isLoading,
  showDateGroups = true,
}: TransactionListProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  if (isLoading) {
    return <Loading className="py-12" />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="w-8 h-8" />}
        title="No transactions yet"
        description="Your bank transactions will appear here once they're synced."
      />
    );
  }

  if (showDateGroups && groupedByDate) {
    return (
      <>
        <div className="divide-y divide-slate-100">
          {Object.entries(groupedByDate).map(([date, txs]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-slate-50 sticky top-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {date}
                </p>
              </div>
              {txs.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onClick={() => setSelectedTransaction(tx)}
                />
              ))}
            </div>
          ))}
        </div>

        {selectedTransaction && (
          <TransactionDetail
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {transactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            onClick={() => setSelectedTransaction(tx)}
          />
        ))}
      </div>

      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </>
  );
}
