import React from 'react';
import { formatDateOnly } from '@/lib/dateUtils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { ButtonV2 } from '@/components/ui/ButtonV2';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';

interface ProviderDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: {
    providerId: number;
    providerName: string;
    balance: number;
    creditLine: number;
    usedCredit: number;
    availableToSpend: number;
  };
}

export const ProviderDetailDrawer: React.FC<ProviderDetailDrawerProps> = ({
  open,
  onOpenChange,
  provider,
}) => {
  // Fetch provider insights
  const { data: insightsData, isLoading: isLoadingInsights, error: insightsError } = trpc.financial.providerInsights.useQuery(
    { limit: 50, sortBy: 'volume' },
    { enabled: open }
  );

  // Find the current provider's insights
  const providerInsight = insightsData?.find((insight: any) => insight.providerId === provider.providerId);

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return formatDateOnly(date);
  };

  const creditUsagePercent = provider.creditLine > 0 ? (provider.usedCredit / provider.creditLine) * 100 : 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                <span className="text-xs font-bold text-blue-600">
                  {provider.providerName.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <DrawerTitle className="text-lg">{provider.providerName}</DrawerTitle>
                <DrawerDescription>Provider performance and analytics</DrawerDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
            >
              <X size={18} className="text-slate-600" strokeWidth={2} />
            </button>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Account Balance Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Account Balance</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="py-4">
                  <div className="text-xs font-medium text-slate-600 mb-1">Balance</div>
                  <div className="num text-lg font-bold text-slate-900">{'د.ل '}{formatCurrency(provider.balance)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-xs font-medium text-slate-600 mb-1">Credit Line</div>
                  <div className="num text-lg font-bold text-slate-900">{'د.ل '}{formatCurrency(provider.creditLine)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-xs font-medium text-slate-600 mb-1">Used Credit</div>
                  <div className="num text-lg font-bold text-slate-900">{'د.ل '}{formatCurrency(provider.usedCredit)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-xs font-medium text-slate-600 mb-1">Available</div>
                  <div className="num text-lg font-bold text-emerald-600">{'د.ل '}{formatCurrency(provider.availableToSpend)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Credit Usage Progress */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Credit Usage</span>
                <span className="text-xs font-semibold text-slate-900">{Math.round(creditUsagePercent)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${creditUsagePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Provider Insights Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Performance Analytics</h3>

            {isLoadingInsights ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="text-slate-400 animate-spin" strokeWidth={1.5} />
              </div>
            ) : insightsError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <p className="text-sm font-medium text-red-800">Failed to load insights</p>
                    <p className="text-xs text-red-600 mt-1">{insightsError.message}</p>
                  </div>
                </div>
              </div>
            ) : providerInsight ? (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="py-4">
                    <div className="text-xs font-medium text-slate-600 mb-1">Total Purchases</div>
                    <div className="num text-lg font-bold text-slate-900">{'د.ل '}{formatCurrency(providerInsight.totalPurchases)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-xs font-medium text-slate-600 mb-1">Transactions</div>
                    <div className="text-lg font-bold text-slate-900">{providerInsight.totalTransactions}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-xs font-medium text-slate-600 mb-1">Commission Earned</div>
                    <div className="num text-lg font-bold text-emerald-600">{'د.ل '}{formatCurrency(providerInsight.totalCommissionEarned)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-xs font-medium text-slate-600 mb-1">Avg Commission</div>
                    <div className="num text-lg font-bold text-slate-900">{'د.ل '}{formatCurrency(providerInsight.avgCommissionPerTransaction)}</div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <p className="text-sm text-slate-600">No transaction data available</p>
              </div>
            )}
          </div>

          {/* Timeline Section */}
          {providerInsight && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Timeline</h3>
              <div className="space-y-3">
                <Card>
                  <CardContent className="py-4">
                    <div className="text-xs font-medium text-slate-600 mb-1">Connected Since</div>
                    <div className="text-sm font-semibold text-slate-900">{formatDate(providerInsight.connectionDate)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-xs font-medium text-slate-600 mb-1">First Transaction</div>
                    <div className="text-sm font-semibold text-slate-900">{formatDate(providerInsight.firstTransactionDate)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="text-xs font-medium text-slate-600 mb-1">Last Transaction</div>
                    <div className="text-sm font-semibold text-slate-900">{formatDate(providerInsight.lastTransactionDate)}</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-slate-200">
          <ButtonV2 variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </ButtonV2>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
