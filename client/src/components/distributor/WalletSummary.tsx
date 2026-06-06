import React from 'react';
import { formatDateTime } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

export interface WalletData {
  balance: number;
  currency: string;
  totalSpent: number;
  totalEarned: number;
  lastUpdated?: Date;
}

export interface WalletSummaryProps {
  wallet: WalletData;
  isLoading?: boolean;
  error?: string | null;
  lowBalanceThreshold?: number;
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onRefresh?: () => void;
}

export const WalletSummary: React.FC<WalletSummaryProps> = ({
  wallet,
  isLoading = false,
  error = null,
  lowBalanceThreshold = 5000,
  onTopUp,
  onWithdraw,
  onRefresh,
}) => {
  const isLowBalance = wallet.balance < lowBalanceThreshold;

  return (
    <div className="space-y-6">
      {/* Main Wallet Card */}
      <Card className={isLowBalance ? 'border-[#fcd34d] bg-[#fef3c7]' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#00236f]" />
              <CardTitle>رصيد المحفظة</CardTitle>
            </div>
            {onRefresh && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={isLoading}
              >
                تحديث
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balance Display */}
          <div className="text-center py-4">
            <p className="text-sm text-[#444651] mb-2">الرصيد الحالي</p>
            <p className="num text-5xl font-bold text-[#00236f]">
              {'د.ل '}{wallet.balance.toFixed(2)}
            </p>
            <p className="text-xs text-[#444651] mt-2">{wallet.currency}</p>
          </div>

          {/* Low Balance Alert */}
          {isLowBalance && (
            <div className="p-4 bg-[#fef3c7] border border-[#fcd34d] rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#b45309] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#b45309]">رصيد منخفض</p>
                <p className="text-sm text-[#b45309]">
                  رصيدك أقل من <span className="num">{'د.ل '}{lowBalanceThreshold.toFixed(2)}</span>
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#b91c1c] flex-shrink-0 mt-0.5" />
              <p className="text-[#b91c1c] text-sm">{error}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#e2e8f0]">
            <div>
              <p className="text-xs text-[#444651] mb-1">إجمالي المصروف</p>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-[#b91c1c]" />
                <p className="num font-medium">{'د.ل '}{wallet.totalSpent.toFixed(2)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-[#444651] mb-1">إجمالي المكتسب</p>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0f766e]" />
                <p className="num font-medium">{'د.ل '}{wallet.totalEarned.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Last Updated */}
          {wallet.lastUpdated && (
            <p className="text-xs text-[#444651] text-center">
              آخر تحديث: {formatDateTime(wallet.lastUpdated)}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-[#e2e8f0]">
            {onTopUp && (
              <Button
                onClick={onTopUp}
                disabled={isLoading}
                className="flex-1 bg-[#00236f] hover:bg-[#00164e]"
              >
                شحن
              </Button>
            )}
            {onWithdraw && (
              <Button
                onClick={onWithdraw}
                disabled={isLoading || wallet.balance === 0}
                variant="outline"
                className="flex-1"
              >
                سحب
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletSummary;
