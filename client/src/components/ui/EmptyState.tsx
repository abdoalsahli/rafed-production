/**
 * EmptyState — centered placeholder shown when a list / table has no data.
 *
 * Visual (from DESIGN.md + screenshots):
 *   • Centered column layout inside a white card
 *   • 64×64 soft-tinted icon container (rounded-xl = 12px radius)
 *   • Arabic title (bold, 16px)
 *   • Optional description (muted, 13px)
 *   • Optional primary CTA button (deep navy)
 *
 * Usage:
 *   <EmptyState
 *     icon={<Inbox size={28} />}
 *     title="لا توجد عمليات حالياً"
 *     description="لم يتم تسجيل أي عمليات بيع أو تحويل رصيد حتى الآن."
 *     action={{ label: '+ إنشاء عملية يدوية', onClick: () => {} }}
 *   />
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

const ICON_CONTAINER_STYLES: Record<string, string> = {
  primary: 'bg-[#dce1ff] text-[#264191]',
  teal:    'bg-[#86f2e4] text-[#005049]',
  amber:   'bg-[#fef3c7] text-[#b45309]',
  red:     'bg-[#fee2e2] text-[#b91c1c]',
  muted:   'bg-[#e5eeff] text-[#444651]',
};

export interface EmptyStateProps {
  /** Icon element — recommended size 28–32px */
  icon?: React.ReactNode;
  /** Primary message — bold, Arabic */
  title: string;
  /** Secondary description — muted */
  description?: string;
  /** CTA button config */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Icon container colour variant */
  iconVariant?: 'primary' | 'teal' | 'amber' | 'red' | 'muted';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  iconVariant = 'muted',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-16 px-8 gap-4',
        className,
      )}
    >
      {/* Icon container — 64×64, rounded-xl, soft tinted background */}
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center',
            'w-16 h-16 rounded-xl shrink-0',
            ICON_CONTAINER_STYLES[iconVariant],
          )}
        >
          {icon}
        </div>
      )}

      {/* Text block */}
      <div className="space-y-2 max-w-sm">
        <h3 className="text-base font-bold text-[#0b1c30] leading-tight">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-[#444651] leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* CTA button */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'mt-2 inline-flex items-center gap-2',
            'px-5 py-2.5 rounded-lg',
            'bg-[#00236f] text-white text-sm font-semibold',
            'hover:bg-[#1e3a8a] transition-colors duration-150',
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
