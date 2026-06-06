/**
 * Global Design System for Fintech UI
 * Ensures consistency across all dashboards (Stripe/PayPal level)
 */

export const FinTechColors = {
  // Primary financial colors
  success: {
    light: '#ecfdf5',
    main: '#10b981',
    dark: '#047857',
  },
  error: {
    light: '#fef2f2',
    main: '#ef4444',
    dark: '#dc2626',
  },
  warning: {
    light: '#fffbeb',
    main: '#f59e0b',
    dark: '#d97706',
  },
  info: {
    light: '#eff6ff',
    main: '#3b82f6',
    dark: '#1d4ed8',
  },

  // Semantic colors for financial data
  earnings: '#10b981', // Green
  debit: '#ef4444', // Red
  pending: '#f59e0b', // Yellow
  credit: '#10b981', // Green
  failure: '#ef4444', // Red
  neutral: '#6b7280', // Gray

  // Neutral palette
  background: '#ffffff',
  surface: '#f9fafb',
  border: '#e5e7eb',
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
  },
};

export const FinTechTypography = {
  // Large numbers (wallet balance, revenue)
  largeNumber: {
    fontSize: '2.25rem', // 36px
    fontWeight: '700',
    lineHeight: '2.5rem',
  },

  // Important numbers (transaction amount, commission)
  importantNumber: {
    fontSize: '1.5rem', // 24px
    fontWeight: '600',
    lineHeight: '2rem',
  },

  // Secondary numbers (counts, percentages)
  secondaryNumber: {
    fontSize: '1.125rem', // 18px
    fontWeight: '500',
    lineHeight: '1.75rem',
  },

  // Labels and descriptions
  label: {
    fontSize: '0.875rem', // 14px
    fontWeight: '500',
    lineHeight: '1.25rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },

  // Body text
  body: {
    fontSize: '0.9375rem', // 15px
    fontWeight: '400',
    lineHeight: '1.5rem',
  },

  // Small text (hints, secondary info)
  small: {
    fontSize: '0.8125rem', // 13px
    fontWeight: '400',
    lineHeight: '1.25rem',
  },
};

export const FinTechSpacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem', // 48px
};

export const FinTechRadius = {
  sm: '0.375rem', // 6px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
};

export const FinTechShadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

/**
 * Status badge styling
 */
export const StatusStyles = {
  completed: {
    bg: FinTechColors.success.light,
    text: FinTechColors.success.dark,
    border: '#a7f3d0',
  },
  pending: {
    bg: FinTechColors.warning.light,
    text: FinTechColors.warning.dark,
    border: '#fcd34d',
  },
  failed: {
    bg: FinTechColors.error.light,
    text: FinTechColors.error.dark,
    border: '#fca5a5',
  },
  active: {
    bg: FinTechColors.info.light,
    text: FinTechColors.info.dark,
    border: '#93c5fd',
  },
  inactive: {
    bg: '#f3f4f6',
    text: '#4b5563',
    border: '#d1d5db',
  },
};

/**
 * Financial data formatting
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatPercentage = (num: number, decimals = 1): string => {
  return `${(num * 100).toFixed(decimals)}%`;
};

/**
 * Get color for financial value
 */
export const getFinancialColor = (
  type: 'credit' | 'debit' | 'earnings' | 'failure' | 'pending'
): string => {
  switch (type) {
    case 'credit':
    case 'earnings':
      return FinTechColors.earnings;
    case 'debit':
    case 'failure':
      return FinTechColors.debit;
    case 'pending':
      return FinTechColors.pending;
    default:
      return FinTechColors.neutral;
  }
};

/**
 * Get status style
 */
export const getStatusStyle = (
  status: 'completed' | 'pending' | 'failed' | 'active' | 'inactive'
) => {
  return StatusStyles[status];
};
