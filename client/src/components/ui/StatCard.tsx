/**
 * StatCard — KPI / summary card used in dashboard grids.
 *
 * Layout (RTL):
 *   ┌──────────────────────────────┐
 *   │  [icon box]    [trend/badge] │  ← flex justify-between, icon on RIGHT (RTL start)
 *   │                              │
 *   │                  label text  │  ← right-aligned (RTL default)
 *   │           large value  unit  │
 *   └──────────────────────────────┘
 */

import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Icon-box colour variants ────────────────────────────────────────────── */
const ICON_BOX_STYLES: Record<string, string> = {
  primary: 'bg-[#dce1ff] text-[#00164e]',   /* rf-primary-fixed */
  teal:    'bg-[#86f2e4] text-[#005049]',   /* rf-secondary-container */
  amber:   'bg-[#ffdbcb] text-[#773205]',   /* rf-tertiary-fixed */
  red:     'bg-[#ffdad6] text-[#93000a]',   /* rf-error-container */
  muted:   'bg-[#e5eeff] text-[#444651]',   /* rf-surface-container */
};

/* ── Trend badge colour variants ─────────────────────────────────────────── */
const TREND_STYLES = {
  up:   'bg-[#dcfce7] text-[#15803d]',
  down: 'bg-[#fee2e2] text-[#b91c1c]',
};

/* ── Pill badge variant styles ───────────────────────────────────────────── */
const BADGE_STYLES: Record<string, string> = {
  overlimit: 'bg-[#fce7f3] text-[#be185d]',
  pending:   'bg-[#fef3c7] text-[#b45309]',
  error:     'bg-[#fee2e2] text-[#b91c1c]',
  active:    'bg-[#ccfbf1] text-[#0f766e]',
  inactive:  'bg-[#f1f5f9] text-[#64748b]',
};

/* ── Props ───────────────────────────────────────────────────────────────── */
export interface StatCardProps {
  /** Card label / metric name */
  title: string;
  /** The main displayed value (number or formatted string) */
  value: string | number;
  /** Optional unit shown after the value — e.g. "ر.س", "موزع" */
  unit?: string;
  /**
   * Trend percentage (positive = up, negative = down).
   * Pass `undefined` to hide the trend badge entirely.
   */
  trend?: number;
  /** Period label appended to trend — defaults to "مر" */
  trendPeriod?: string;
  /** Icon element rendered inside the 40×40 icon box */
  icon: React.ReactNode;
  /** Colour tint for the icon box */
  iconVariant?: 'primary' | 'teal' | 'amber' | 'red' | 'muted';
  /**
   * Static status badge text (e.g. "تجاوز الحد", "رصيد منخفض").
   * Shown in place of the trend badge when `trend` is undefined.
   */
  badge?: string;
  badgeVariant?: 'overlimit' | 'pending' | 'error' | 'active' | 'inactive';
  className?: string;
}

export function StatCard({
  title,
  value,
  unit,
  trend,
  trendPeriod = 'مر',
  icon,
  iconVariant = 'primary',
  badge,
  badgeVariant = 'inactive',
  className,
}: StatCardProps) {
  const hasTrend  = trend !== undefined;
  const isUp      = hasTrend && trend >= 0;
  const trendSign = isUp ? '+' : '';

  return (
    <div
      className={cn(
        'bg-white border border-[#e2e8f0] rounded-lg p-6 flex flex-col gap-4',
        className,
      )}
    >
      {/* ── Top row: icon (RIGHT in RTL) + trend/badge (LEFT in RTL) ──── */}
      <div className="flex items-start justify-between">

        {/* Icon box — 40×40, 8px radius, soft tinted colour */}
        {/*  RTL justify-between: first child → rightmost  */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
            ICON_BOX_STYLES[iconVariant],
          )}
        >
          {icon}
        </div>

        {/* Trend badge OR static status badge — last child → leftmost */}
        {hasTrend ? (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold leading-none',
              isUp ? TREND_STYLES.up : TREND_STYLES.down,
            )}
          >
            {isUp
              ? <TrendingUp  size={11} strokeWidth={2.5} />
              : <TrendingDown size={11} strokeWidth={2.5} />
            }
            <span>{trendSign}{Math.abs(trend!)}%</span>
            {trendPeriod && (
              <span className="opacity-60 font-normal">{trendPeriod}</span>
            )}
          </div>
        ) : badge ? (
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-semibold leading-none',
              BADGE_STYLES[badgeVariant],
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {/* ── Bottom: label + value ─────────────────────────────────────── */}
      <div className="space-y-1">
        {/* Label — body-sm, muted, right-aligned (RTL default) */}
        <p className="text-sm text-[#444651] leading-tight">{title}</p>

        {/* Value row — number uses Inter (LTR), unit uses Tajawal */}
        <div className="flex items-baseline gap-1.5">
          {/*
            RTL flex: number (first) → rightmost, unit (second) → leftmost.
            Visual left-to-right: [unit] [number] = e.g. "د.ل 289.00"
          */}
          <span className="num font-bold text-[#0b1c30] leading-tight text-[1.5rem]">
            {typeof value === 'number' ? value.toLocaleString('en-US') : value}
          </span>
          {unit && (
            <span className="text-sm font-semibold text-[#444651]">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}
