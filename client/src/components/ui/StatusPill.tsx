/**
 * StatusPill — consistent status badge for transactions, distributors, etc.
 *
 * Accepts either a raw `status` string (auto-mapped from Arabic/English)
 * or explicit `variant` + `children` for full control.
 *
 * Status map:
 *   ناجحة / success       → green
 *   قيد المعالجة / processing → blue  (animated spinner)
 *   فشلت / failed         → red
 *   معلقة / pending       → amber
 *   نشط / active          → teal
 *   موقوف / suspended     → slate gray
 *   تجاوز الحد / over_limit → pink
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Variant definitions ─────────────────────────────────────────────────── */
type Variant = 'success' | 'process' | 'error' | 'pending' | 'active' | 'inactive' | 'overlimit';

const VARIANT_STYLES: Record<Variant, { pill: string; dot: string }> = {
  success:   { pill: 'bg-[#dcfce7] text-[#15803d]', dot: 'bg-[#16a34a]' },
  process:   { pill: 'bg-[#dbeafe] text-[#1d4ed8]', dot: '' /* spinner */ },
  error:     { pill: 'bg-[#fee2e2] text-[#b91c1c]', dot: 'bg-[#dc2626]' },
  pending:   { pill: 'bg-[#fef3c7] text-[#b45309]', dot: 'bg-[#d97706]' },
  active:    { pill: 'bg-[#ccfbf1] text-[#0f766e]', dot: 'bg-[#0d9488]' },
  inactive:  { pill: 'bg-[#f1f5f9] text-[#64748b]', dot: '' /* no dot */ },
  overlimit: { pill: 'bg-[#fce7f3] text-[#be185d]', dot: '' /* no dot */ },
};

const VARIANT_LABELS: Record<Variant, string> = {
  success:   'ناجحة',
  process:   'قيد المعالجة',
  error:     'فشلت',
  pending:   'معلقة',
  active:    'نشط',
  inactive:  'موقوف',
  overlimit: 'تجاوز الحد',
};

/* Auto-detect variant from common Arabic + English status strings */
const STATUS_TO_VARIANT: Record<string, Variant> = {
  /* Arabic */
  'ناجحة': 'success',
  'نجاح': 'success',
  'مكتملة': 'success',
  'مكتمل': 'success',
  'قيد المعالجة': 'process',
  'جاري المعالجة': 'process',
  'قيد التنفيذ': 'process',
  'فشلت': 'error',
  'فشل': 'error',
  'مرفوض': 'error',
  'معلقة': 'pending',
  'معلق': 'pending',
  'رصيد منخفض': 'pending',
  'نشط': 'active',
  'نشطة': 'active',
  'مفعّل': 'active',
  'موقوف': 'inactive',
  'موقوفة': 'inactive',
  'معطل': 'inactive',
  'غير نشط': 'inactive',
  'تجاوز الحد': 'overlimit',
  'تجاوز حد الائتمان': 'overlimit',
  /* English */
  success:     'success',
  successful:  'success',
  completed:   'success',
  processing:  'process',
  pending:     'pending',
  failed:      'error',
  failure:     'error',
  rejected:    'error',
  active:      'active',
  inactive:    'inactive',
  suspended:   'inactive',
  disabled:    'inactive',
  over_limit:  'overlimit',
  overlimit:   'overlimit',
  overLimit:   'overlimit',
  'over-limit':'overlimit',
};

function detectVariant(status: string): Variant {
  return STATUS_TO_VARIANT[status]
    ?? STATUS_TO_VARIANT[status.toLowerCase()]
    ?? 'inactive';
}

/* ── Props ───────────────────────────────────────────────────────────────── */
export interface StatusPillProps {
  /**
   * Status string — auto-mapped to a variant.
   * You can pass Arabic ("ناجحة") or English ("success").
   */
  status?: string;
  /** Explicit variant override — takes precedence over `status` */
  variant?: Variant;
  /** Override the display label; defaults to Arabic label for the variant */
  children?: React.ReactNode;
  /** Whether to render a leading dot indicator (default: true) */
  showDot?: boolean;
  className?: string;
}

export function StatusPill({
  status,
  variant: variantProp,
  children,
  showDot = true,
  className,
}: StatusPillProps) {
  const variant: Variant = variantProp ?? (status ? detectVariant(status) : 'inactive');
  const { pill, dot } = VARIANT_STYLES[variant];
  const label = children ?? VARIANT_LABELS[variant];
  const isProcess = variant === 'process';

  return (
    <span
      className={cn(
        /* base pill */
        'inline-flex items-center gap-1.5 px-2.5 py-0.5',
        'rounded-full text-xs font-semibold leading-5 whitespace-nowrap',
        "font-['Tajawal',sans-serif]",
        pill,
        className,
      )}
    >
      {/*
        RTL flex: first child → rightmost (dot/spinner on RIGHT = reading start).
        Label is second → to the LEFT of the indicator.
      */}
      {showDot && (
        isProcess ? (
          /* Animated spinner for "قيد المعالجة" */
          <Loader2
            size={10}
            className="animate-spin shrink-0"
            strokeWidth={2.5}
          />
        ) : dot ? (
          <span
            className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)}
          />
        ) : null
      )}
      <span>{label}</span>
    </span>
  );
}

export { type Variant as StatusVariant };
