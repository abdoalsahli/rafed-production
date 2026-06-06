import React from 'react';

/**
 * Skeleton loader for large numbers (wallet balance, revenue)
 */
export const LargeNumberSkeleton: React.FC = () => (
  <div className="space-y-2">
    <div className="h-9 bg-gray-200 rounded-lg w-48 animate-pulse"></div>
    <div className="h-4 bg-gray-100 rounded w-32 animate-pulse"></div>
  </div>
);

/**
 * Skeleton loader for metric cards
 */
export const MetricCardSkeleton: React.FC = () => (
  <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
    <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
    <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
    <div className="h-3 bg-gray-100 rounded w-20 animate-pulse"></div>
  </div>
);

/**
 * Skeleton loader for table rows
 */
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 6 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, idx) => (
      <td key={idx} className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </td>
    ))}
  </tr>
);

/**
 * Skeleton loader for table with multiple rows
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 6,
}) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, idx) => (
      <TableRowSkeleton key={idx} columns={columns} />
    ))}
  </div>
);

/**
 * Skeleton loader for card list
 */
export const CardListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
        <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="h-3 bg-gray-100 rounded w-40 animate-pulse"></div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for dashboard section
 */
export const DashboardSectionSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <MetricCardSkeleton key={idx} />
      ))}
    </div>
  </div>
);

/**
 * Skeleton loader for chart
 */
export const ChartSkeleton: React.FC = () => (
  <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="h-8 bg-gray-200 rounded flex-1 animate-pulse"></div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Full page skeleton loader
 */
export const FullPageSkeleton: React.FC = () => (
  <div className="space-y-8 p-6">
    <DashboardSectionSkeleton />
    <DashboardSectionSkeleton />
    <DashboardSectionSkeleton />
  </div>
);
