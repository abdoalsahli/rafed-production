import React, { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

export interface RevenueData {
  date: string;
  revenue: number;
}

export interface ProductSales {
  productName: string;
  sales: number;
  percentage: number;
}

interface ReportsProps {
  revenueData: RevenueData[];
  productSales: ProductSales[];
  isLoading?: boolean;
}

export const Reports: React.FC<ReportsProps> = ({
  revenueData,
  productSales,
  isLoading = false,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Calculate chart dimensions
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue));
  const chartHeight = 200;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Over Time */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Revenue Over Time</h3>
            <p className="text-sm text-gray-600 mt-1">Daily revenue for the selected period</p>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="space-y-2">
          {revenueData.map((data, index) => {
            const barWidth = (data.revenue / maxRevenue) * 100;
            return (
              <div key={index} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-12">{data.date}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="num text-xs font-semibold text-gray-900 w-16 text-right">
                  {'د.ل '}{data.revenue.toLocaleString('en-US')}
                </span>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1">Total</p>
            <p className="num text-xl font-bold text-gray-900">
              {'د.ل '}{revenueData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1">Average</p>
            <p className="num text-xl font-bold text-gray-900">
              {'د.ل '}{Math.round(revenueData.reduce((sum, d) => sum + d.revenue, 0) / revenueData.length).toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide mb-1">Peak</p>
            <p className="num text-xl font-bold text-green-600">
              {'د.ل '}{Math.max(...revenueData.map((d) => d.revenue)).toLocaleString('en-US')}
            </p>
          </div>
        </div>
      </div>

      {/* Sales by Product */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Sales by Product</h3>
          <p className="text-sm text-gray-600">Top performing products</p>
        </div>

        <div className="mt-6 space-y-4">
          {productSales.map((product, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900">{product.productName}</p>
                  <span className="num text-sm font-semibold text-gray-900">
                    {'د.ل '}{product.sales.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      index === 0
                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                        : index === 1
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                        : index === 2
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                        : 'bg-gradient-to-r from-orange-500 to-orange-600'
                    }`}
                    style={{ width: `${product.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">{product.percentage}% of total</p>
              </div>
            </div>
          ))}
        </div>

        {/* Product Stats */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-xs text-green-700 font-semibold uppercase tracking-wide mb-1">Best Performer</p>
              <p className="text-lg font-bold text-green-900">{productSales[0]?.productName || 'N/A'}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide mb-1">Total Products</p>
              <p className="text-lg font-bold text-blue-900">{productSales.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
