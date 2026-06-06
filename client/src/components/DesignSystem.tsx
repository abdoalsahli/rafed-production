import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * MetricCard Component
 * Displays key metrics with optional trend indicator
 */
export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
  status?: 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  trend,
  status = 'neutral',
  className = '',
}) => {
  const statusColors = {
    success: 'bg-green-50 border-green-200',
    warning: 'bg-orange-50 border-orange-200',
    error: 'bg-red-50 border-red-200',
    neutral: 'bg-blue-50 border-blue-200',
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
  };

  return (
    <div className={`${statusColors[status]} border rounded-lg p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${trendColors[trend.direction]}`}>
              {trend.direction === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{trend.percentage}%</span>
            </div>
          )}
        </div>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
    </div>
  );
};

/**
 * StatusBadge Component
 * Displays status with color coding
 */
export interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'failed' | 'verified' | 'under-review';
  label?: string;
  className?: string;
}

const statusConfig = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'نشط' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'غير نشط' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'قيد الانتظار' },
  completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'مكتمل' },
  failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'فاشل' },
  verified: { bg: 'bg-green-100', text: 'text-green-800', label: 'تم التحقق' },
  'under-review': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'قيد المراجعة' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text} ${className}`}>
      <span className={`w-2 h-2 rounded-full ${config.bg.replace('100', '600')}`} />
      {displayLabel}
    </span>
  );
};

/**
 * DataTable Component
 * Displays tabular data with sorting and filtering support
 */
export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps<any>>(
  ({ columns, data, onRowClick, loading = false, emptyMessage = 'لا توجد بيانات', className = '' }, ref) => {
    if (loading) {
      return (
        <div className={`${className}`} ref={ref}>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className={`text-center py-12 ${className}`} ref={ref}>
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className={`overflow-x-auto ${className}`} ref={ref}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-6 py-3 text-sm font-semibold text-gray-900 text-${col.align || 'right'}`}
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-6 py-4 text-sm text-gray-900 text-${col.align || 'right'}`}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

DataTable.displayName = 'DataTable';

/**
 * FilterBar Component
 * Displays filter controls
 */
export interface FilterOption {
  id: string;
  label: string;
  value: string;
}

export interface FilterBarProps {
  filters: {
    label: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
  }[];
  onExport?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onExport, className = '' }) => {
  return (
    <div className={`flex items-center gap-4 flex-wrap ${className}`}>
      {filters.map((filter) => (
        <div key={filter.label} className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">{filter.label}</label>
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {filter.options.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {onExport && (
        <button
          onClick={onExport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          تصدير CSV
        </button>
      )}
    </div>
  );
};

/**
 * Pagination Component
 * Displays pagination controls
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) => {
  const pages = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (!pages.includes(i)) pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className={`flex items-center gap-2 justify-center ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        السابق
      </button>

      {pages.map((page, idx) => (
        <button
          key={idx}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            page === currentPage
              ? 'bg-blue-600 text-white'
              : page === '...'
              ? 'cursor-default'
              : 'border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        التالي
      </button>
    </div>
  );
};

/**
 * EmptyState Component
 * Displays empty state with icon and message
 */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && <div className="flex justify-center mb-4 text-4xl">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-gray-500 mb-6">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

/**
 * LoadingState Component
 * Displays loading skeleton
 */
export interface LoadingStateProps {
  rows?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ rows = 5, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
      ))}
    </div>
  );
};
