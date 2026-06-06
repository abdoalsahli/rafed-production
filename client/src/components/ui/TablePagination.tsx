import React from 'react';
import { Button } from './button';

/**
 * TablePaginationFooter
 *
 * Renders a compact footer below any table with:
 *   RIGHT (RTL-start)  → "السابق" / "التالي" navigation buttons
 *   LEFT  (RTL-end)    → "صفحة X من Y  |  عرض A–B من N سجل"
 *
 * Hidden automatically when totalRows === 0.
 */
export interface TablePaginationFooterProps {
  /** 1-indexed current page */
  page: number;
  totalPages: number;
  pageSize: number;
  totalRows: number;
  onPrev: () => void;
  onNext: () => void;
}

export function TablePaginationFooter({
  page,
  totalPages,
  pageSize,
  totalRows,
  onPrev,
  onNext,
}: TablePaginationFooterProps) {
  if (totalRows === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalRows);
  const safe = Math.max(1, totalPages);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-[#e2e8f0] bg-[#fafbff] text-xs">

      {/* Info — first DOM child = RIGHT in RTL */}
      <div className="flex items-center gap-3 text-[#444651]">
        <span>
          <span className="num">{to.toLocaleString('en-US')}–{from.toLocaleString('en-US')}</span>
          {' '}من{' '}
          <span className="num font-semibold text-[#0b1c30]">
            {totalRows.toLocaleString('en-US')}
          </span>
          {' '}سجل
        </span>
        <span className="text-[#cbd5e1]">|</span>
        <span>
          صفحة{' '}
          <span className="num font-semibold text-[#0b1c30]">{page}</span>
          {' '}من{' '}
          <span className="num font-semibold text-[#0b1c30]">{safe}</span>
        </span>
      </div>

      {/* Buttons — second DOM child = LEFT in RTL */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page <= 1}
          className="h-7 px-3 text-xs"
        >
          السابق
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= safe}
          className="h-7 px-3 text-xs"
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
