/**
 * Skeleton — loading placeholder components.
 *
 * Exports:
 *   Skeleton         — base building block (single shimmer block)
 *   StatCardSkeleton — matches StatCard layout (4-card KPI row)
 *   TableSkeleton    — matches DataTable layout (header + N rows)
 */

import { cn } from '@/lib/utils';

/* ── Base skeleton block ─────────────────────────────────────────────────── */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-md bg-[#e5eeff]',
        className,
      )}
      {...props}
    />
  );
}

/* ── StatCard skeleton — mirrors the StatCard layout ─────────────────────── */
function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-white border border-[#e2e8f0] rounded-lg p-6 flex flex-col gap-4',
        className,
      )}
    >
      {/* Top row: icon box + trend badge */}
      <div className="flex items-start justify-between">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-16 h-6 rounded-md" />
      </div>
      {/* Bottom: label + value */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-7 w-36 rounded" />
      </div>
    </div>
  );
}

/* ── Table skeleton — header + configurable row count ────────────────────── */
interface TableSkeletonProps {
  /** Number of skeleton rows to render (default: 5) */
  rows?: number;
  /** Number of columns (default: 5) */
  cols?: number;
  className?: string;
}

function TableSkeleton({ rows = 5, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn('w-full overflow-hidden', className)}>
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-[#e2e8f0]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4 rounded flex-1"
            style={{ opacity: 0.6 }}
          />
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 px-4 py-3 border-b border-[#e2e8f0]/60"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className="h-4 rounded flex-1"
              style={{
                /* Slightly varied widths feel more natural */
                maxWidth: colIdx === 0 ? '80px' : colIdx === cols - 1 ? '60px' : undefined,
                animationDelay: `${(rowIdx * cols + colIdx) * 40}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, StatCardSkeleton, TableSkeleton };
