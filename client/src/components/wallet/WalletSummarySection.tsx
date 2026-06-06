import { TrendingUp, TrendingDown } from 'lucide-react';

interface WalletSummarySectionProps {
  balance: number;
  creditLine: number;
  lastUpdated?: Date;
}

export function WalletSummarySection({
  balance,
  creditLine,
  lastUpdated,
}: WalletSummarySectionProps) {
  const availableToSpend = balance + creditLine;
  const creditUsagePercent = ((creditLine - (availableToSpend - balance)) / creditLine) * 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8 shadow-md">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
          Wallet Balance
        </h2>
        <p className="num text-4xl font-bold text-gray-900">{'د.ل '}{balance.toLocaleString('en-US')}</p>
        {lastUpdated && (
          <p className="text-xs text-gray-600 mt-2">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Available to Spend */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Available to Spend
            </p>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="num text-3xl font-bold text-green-600 mb-1">
            {'د.ل '}{availableToSpend.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-600">Balance + Credit Line</p>
        </div>

        {/* Credit Line */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Credit Line
            </p>
            <TrendingDown className="w-4 h-4 text-orange-600" />
          </div>
          <p className="num text-3xl font-bold text-gray-900 mb-1">{'د.ل '}{creditLine.toLocaleString('en-US')}</p>
          <p className="text-xs text-gray-600">Total available credit</p>
        </div>

        {/* Credit Usage */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
            Credit Usage
          </p>
          <p className="text-3xl font-bold text-gray-900 mb-3">{creditUsagePercent.toFixed(1)}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                creditUsagePercent > 80 ? 'bg-red-600' : creditUsagePercent > 50 ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(creditUsagePercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
        <p className="text-sm text-blue-900">
          <strong>How it works:</strong> Your Available to Spend is your current wallet balance plus your credit line. You can use both to make purchases. Credit usage shows how much of your credit line is currently being used.
        </p>
      </div>
    </div>
  );
}
