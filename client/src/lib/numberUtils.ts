/**
 * Number formatting utilities — consistent comma-separated output across the app.
 */

/**
 * Format a financial amount with commas and 2 decimal places.
 * e.g. 1234.5 → "1,234.50"
 */
export function formatAmount(value: number | string | null | undefined, decimals = 2): string {
  const num = value == null ? 0 : typeof value === 'number' ? value : parseFloat(String(value));
  return (isNaN(num) ? 0 : num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a whole number with commas (no decimals).
 * e.g. 12345 → "12,345"
 */
export function formatCount(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('en-US');
}
