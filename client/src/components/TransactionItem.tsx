/**
 * Reusable Transaction Item Component
 * Extracted from demo pages for use across distributor and provider interfaces
 */

import React from "react";
import { formatDateOnly, formatTimeOnly } from "@/lib/dateUtils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Decimal from "decimal.js";

export interface TransactionItemData {
  id: number;
  description: string;
  amount: number;
  commission: number;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

interface TransactionItemProps {
  transaction: TransactionItemData;
  variant?: "list" | "compact";
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  variant = "list",
}) => {
  const { description, amount, commission, timestamp, status } = transaction;

  if (variant === "compact") {
    return (
      <div className="p-3 bg-slate-50 rounded-lg">
        <p className="num text-sm font-semibold text-slate-900">{'د.ل '}{new Decimal(amount).toFixed(2)}</p>
        <p className="text-xs text-slate-600 mt-1">
          {formatDateOnly(timestamp)}
        </p>
        <p className="num text-xs text-green-600 font-semibold mt-1">
          {'د.ل +'}{new Decimal(commission).toFixed(2)} commission
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
      {/* Left side - Icon and Details */}
      <div className="flex items-center gap-4 flex-1">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <ArrowDownRight className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{description}</p>
          <p className="text-sm text-slate-600">
            {formatDateOnly(timestamp)} at {formatTimeOnly(timestamp)}
          </p>
          <div className="flex gap-4 mt-2">
            <div>
              <p className="text-xs text-slate-500">Amount</p>
              <p className="num text-sm font-semibold text-slate-900">
                {'د.ل '}{new Decimal(amount).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Commission</p>
              <p className="num text-sm font-semibold text-green-600">
                {'د.ل +'}{new Decimal(commission).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Status and Amount */}
      <div className="text-right flex-shrink-0 ml-4">
        <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 rounded-full mb-2">
          <div className="w-2 h-2 bg-green-600 rounded-full" />
          <span className="text-xs font-semibold text-green-700">{status}</span>
        </div>
        <p className="num text-lg font-bold text-slate-900">
          {'د.ل -'}{new Decimal(amount).toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default TransactionItem;
