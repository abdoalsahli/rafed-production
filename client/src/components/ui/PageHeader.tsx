/**
 * PageHeader — standard page title bar used at the top of every portal page.
 *
 * Layout (RTL):
 *
 *   [action buttons — LEFT]            [Title — RIGHT]
 *                                       [Subtitle — RIGHT, muted]
 *
 * In RTL justify-between:
 *   • Title block is FIRST in HTML → rightmost (reading start)
 *   • Actions slot is LAST in HTML  → leftmost  (reading end)
 *
 * Usage:
 *   <PageHeader
 *     title="إدارة المنتجات"
 *     subtitle="استعرض وأضف وعدّل منتجاتك الرقمية"
 *     actions={
 *       <>
 *         <Button variant="outline"><SlidersHorizontal size={15}/> تصفية</Button>
 *         <Button><Plus size={15}/> إضافة منتج جديد</Button>
 *       </>
 *     }
 *   />
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Buttons / controls rendered on the left side (RTL end) */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 mb-6',
        className,
      )}
    >
      {/* Title block — first → rightmost in RTL justify-between */}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-[#0b1c30] leading-tight tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-[#444651] leading-relaxed">{subtitle}</p>
        )}
      </div>

      {/* Actions — last → leftmost in RTL justify-between */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
