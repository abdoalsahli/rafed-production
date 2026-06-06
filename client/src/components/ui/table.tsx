/**
 * Table — design-system data table.
 *
 * Visual rules (DESIGN.md):
 *  - No outer borders on the table itself; the parent card provides the border.
 *  - Header: muted text (text-xs font-semibold), slightly heavier bottom line.
 *  - Rows: 1px bottom divider only — no side borders, no background.
 *  - Hover: very subtle tint (#eff4ff = --rf-surface-container-low).
 *  - Padding: px-4 py-3 for a comfortable reading rhythm.
 *  - RTL: text-right by default on all cells; override with className.
 *  - Numeric/ID cells: callers should add `dir="ltr" num`.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ── Table container ─────────────────────────────────────────────────────── */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

/* ── <thead> — adds a single bottom divider separating header from body ──── */
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('border-b border-[#e2e8f0]', className)}
      {...props}
    />
  );
}

/* ── <tbody> — last row has no bottom border ─────────────────────────────── */
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

/* ── <tfoot> ─────────────────────────────────────────────────────────────── */
function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t border-[#e2e8f0] bg-[#f8f9ff] font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

/* ── <tr> — 1px bottom divider + clean hover ─────────────────────────────── */
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-[#e2e8f0]/60',
        'transition-colors duration-100',
        'hover:bg-[#eff4ff]',               /* rf-surface-container-low */
        'data-[state=selected]:bg-[#e5eeff]', /* rf-surface-container */
        className,
      )}
      {...props}
    />
  );
}

/* ── <th> — header cell ──────────────────────────────────────────────────── */
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        /* size & alignment */
        'h-11 px-4 text-right align-middle',
        /* typography — muted, small, semi-bold; Tajawal for Arabic header labels */
        'text-xs font-semibold text-[#444651] whitespace-nowrap tracking-wide',
        /* checkbox column helper */
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

/* ── <td> — data cell ────────────────────────────────────────────────────── */
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-4 py-3.5 align-middle text-right whitespace-nowrap',
        'text-sm text-[#0b1c30] leading-snug',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

/* ── <caption> ───────────────────────────────────────────────────────────── */
function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-[#444651]', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
