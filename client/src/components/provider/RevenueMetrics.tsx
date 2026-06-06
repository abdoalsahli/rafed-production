import React from 'react';
import { TrendingUp, DollarSign, Users, Zap } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  currency?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  currency = false,
  trend,
  icon,
  color,
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  const iconColorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    purple: 'text-purple-600 bg-purple-100',
    orange: 'text-orange-600 bg-orange-100',
  };

  const textColorClasses = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    purple: 'text-purple-900',
    orange: 'text-orange-900',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color]} p-6 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="num text-3xl font-bold text-gray-900">
              {currency ? 'د.ل ' : ''}{typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: currency ? 2 : 0, maximumFractionDigits: currency ? 2 : 0 }) : value}
            </span>
            {trend && (
              <span className={`text-sm font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}%
              </span>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

interface RevenueMetricsProps {
  totalRevenue: number;
  todayRevenue: number;
  commissionPaid: number;
  activeDistributors: number;
  isLoading?: boolean;
}

export const RevenueMetrics: React.FC<RevenueMetricsProps> = ({
  totalRevenue,
  todayRevenue,
  commissionPaid,
  activeDistributors,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
            <div className="h-8 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Revenue - Primary (Largest) */}
      <div className="lg:col-span-1 md:col-span-1">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-2">Total Revenue</p>
              <div className="flex items-baseline gap-2">
                <span className="num text-4xl font-bold text-gray-900">
                  د.ل {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-semibold text-green-600">↑ 12%</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">All-time earnings</p>
            </div>
            <div className="flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center bg-blue-100">
              <DollarSign size={28} className="text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Revenue */}
      <MetricCard
        label="Today's Revenue"
        value={todayRevenue}
        currency
        trend={{ value: 8, isPositive: true }}
        icon={<TrendingUp size={24} />}
        color="green"
      />

      {/* Commission Paid */}
      <MetricCard
        label="Distributor Commissions (30d)"
        value={commissionPaid}
        currency
        trend={{ value: 5, isPositive: false }}
        icon={<Zap size={24} />}
        color="orange"
      />

      {/* Active Distributors */}
      <MetricCard
        label="Active Distributors"
        value={activeDistributors}
        trend={{ value: 3, isPositive: true }}
        icon={<Users size={24} />}
        color="purple"
      />
    </div>
  );
};
