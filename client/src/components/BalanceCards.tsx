/**
 * Reusable Balance Cards Component
 * Extracted from demo pages for use across distributor interfaces
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Wallet, TrendingUp, CreditCard } from "lucide-react";
import Decimal from "decimal.js";

export interface BalanceData {
  balance: number;
  availableToSpend: number;
  creditLine: number;
  usedCredit: number;
}

interface BalanceCardsProps {
  data: BalanceData;
  isLoading?: boolean;
}

export const BalanceCards: React.FC<BalanceCardsProps> = ({
  data,
  isLoading = false,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Current Balance */}
      <Card className="bg-white shadow-lg border-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Current Balance</h3>
            <Wallet className="w-5 h-5 text-blue-600" />
          </div>
          {isLoading ? (
            <div className="h-8 bg-slate-200 rounded animate-pulse" />
          ) : (
            <p className="num text-3xl font-bold text-slate-900">
              {'د.ل '}{new Decimal(data.balance || 0).toFixed(2)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">Direct account balance</p>
        </div>
      </Card>

      {/* Available to Spend */}
      <Card className="bg-white shadow-lg border-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Available to Spend</h3>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          {isLoading ? (
            <div className="h-8 bg-slate-200 rounded animate-pulse" />
          ) : (
            <p className="num text-3xl font-bold text-slate-900">
              {'د.ل '}{new Decimal(data.availableToSpend || 0).toFixed(2)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">Balance + available credit</p>
        </div>
      </Card>

      {/* Credit Line */}
      <Card className="bg-white shadow-lg border-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Credit Line</h3>
            <CreditCard className="w-5 h-5 text-amber-600" />
          </div>
          {isLoading ? (
            <div className="h-8 bg-slate-200 rounded animate-pulse" />
          ) : (
            <>
              <p className="num text-3xl font-bold text-slate-900">
                {'د.ل '}{new Decimal(data.creditLine || 0).toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Used: <span className="num">{'د.ل '}{new Decimal(data.usedCredit || 0).toFixed(2)}</span>
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BalanceCards;
