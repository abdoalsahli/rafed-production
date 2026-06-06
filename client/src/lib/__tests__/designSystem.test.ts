import { describe, it, expect } from 'vitest';
import {
  FinTechColors,
  FinTechTypography,
  formatCurrency,
  formatNumber,
  formatPercentage,
  getFinancialColor,
  getStatusStyle,
  StatusStyles,
} from '../designSystem';

describe('FinTech Design System', () => {
  describe('Colors', () => {
    it('should define success colors', () => {
      expect(FinTechColors.success.main).toBe('#10b981');
      expect(FinTechColors.success.light).toBe('#ecfdf5');
      expect(FinTechColors.success.dark).toBe('#047857');
    });

    it('should define error colors', () => {
      expect(FinTechColors.error.main).toBe('#ef4444');
      expect(FinTechColors.error.light).toBe('#fef2f2');
      expect(FinTechColors.error.dark).toBe('#dc2626');
    });

    it('should define warning colors', () => {
      expect(FinTechColors.warning.main).toBe('#f59e0b');
      expect(FinTechColors.warning.light).toBe('#fffbeb');
      expect(FinTechColors.warning.dark).toBe('#d97706');
    });

    it('should define semantic colors', () => {
      expect(FinTechColors.earnings).toBe('#10b981');
      expect(FinTechColors.debit).toBe('#ef4444');
      expect(FinTechColors.pending).toBe('#f59e0b');
    });
  });

  describe('Typography', () => {
    it('should define large number typography', () => {
      expect(FinTechTypography.largeNumber.fontSize).toBe('2.25rem');
      expect(FinTechTypography.largeNumber.fontWeight).toBe('700');
    });

    it('should define important number typography', () => {
      expect(FinTechTypography.importantNumber.fontSize).toBe('1.5rem');
      expect(FinTechTypography.importantNumber.fontWeight).toBe('600');
    });

    it('should define label typography', () => {
      expect(FinTechTypography.label.fontSize).toBe('0.875rem');
      expect(FinTechTypography.label.textTransform).toBe('uppercase');
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency correctly', () => {
      const formatted = formatCurrency(1234.56);
      expect(formatted).toContain('$');
      expect(formatted).toContain('1,234.56');
    });

    it('should handle zero', () => {
      const formatted = formatCurrency(0);
      expect(formatted).toContain('$');
      expect(formatted).toContain('0.00');
    });

    it('should handle negative numbers', () => {
      const formatted = formatCurrency(-100.50);
      expect(formatted).toContain('-');
      expect(formatted).toContain('100.50');
    });

    it('should handle large numbers', () => {
      const formatted = formatCurrency(1000000);
      expect(formatted).toContain('1,000,000.00');
    });
  });

  describe('Number Formatting', () => {
    it('should format numbers with thousand separators', () => {
      const formatted = formatNumber(1234567);
      expect(formatted).toBe('1,234,567');
    });

    it('should handle zero', () => {
      const formatted = formatNumber(0);
      expect(formatted).toBe('0');
    });

    it('should handle negative numbers', () => {
      const formatted = formatNumber(-1000);
      expect(formatted).toContain('-');
    });
  });

  describe('Percentage Formatting', () => {
    it('should format percentage correctly', () => {
      const formatted = formatPercentage(0.5);
      expect(formatted).toBe('50.0%');
    });

    it('should handle custom decimal places', () => {
      const formatted = formatPercentage(0.333333, 2);
      expect(formatted).toBe('33.33%');
    });

    it('should handle zero', () => {
      const formatted = formatPercentage(0);
      expect(formatted).toBe('0.0%');
    });

    it('should handle 100%', () => {
      const formatted = formatPercentage(1);
      expect(formatted).toBe('100.0%');
    });
  });

  describe('Financial Colors', () => {
    it('should return green for credit', () => {
      const color = getFinancialColor('credit');
      expect(color).toBe(FinTechColors.earnings);
    });

    it('should return green for earnings', () => {
      const color = getFinancialColor('earnings');
      expect(color).toBe(FinTechColors.earnings);
    });

    it('should return red for debit', () => {
      const color = getFinancialColor('debit');
      expect(color).toBe(FinTechColors.debit);
    });

    it('should return red for failure', () => {
      const color = getFinancialColor('failure');
      expect(color).toBe(FinTechColors.debit);
    });

    it('should return yellow for pending', () => {
      const color = getFinancialColor('pending');
      expect(color).toBe(FinTechColors.pending);
    });
  });

  describe('Status Styles', () => {
    it('should provide completed status style', () => {
      const style = getStatusStyle('completed');
      expect(style.bg).toBe(FinTechColors.success.light);
      expect(style.text).toBe(FinTechColors.success.dark);
    });

    it('should provide pending status style', () => {
      const style = getStatusStyle('pending');
      expect(style.bg).toBe(FinTechColors.warning.light);
      expect(style.text).toBe(FinTechColors.warning.dark);
    });

    it('should provide failed status style', () => {
      const style = getStatusStyle('failed');
      expect(style.bg).toBe(FinTechColors.error.light);
      expect(style.text).toBe(FinTechColors.error.dark);
    });

    it('should provide active status style', () => {
      const style = getStatusStyle('active');
      expect(style.bg).toBe(FinTechColors.info.light);
      expect(style.text).toBe(FinTechColors.info.dark);
    });

    it('should provide inactive status style', () => {
      const style = getStatusStyle('inactive');
      expect(style.bg).toBe('#f3f4f6');
    });
  });

  describe('Status Styles Object', () => {
    it('should have all required status styles', () => {
      expect(StatusStyles).toHaveProperty('completed');
      expect(StatusStyles).toHaveProperty('pending');
      expect(StatusStyles).toHaveProperty('failed');
      expect(StatusStyles).toHaveProperty('active');
      expect(StatusStyles).toHaveProperty('inactive');
    });

    it('each status should have bg, text, and border', () => {
      Object.values(StatusStyles).forEach((style) => {
        expect(style).toHaveProperty('bg');
        expect(style).toHaveProperty('text');
        expect(style).toHaveProperty('border');
      });
    });
  });

  describe('Color Consistency', () => {
    it('success and earnings should be the same', () => {
      expect(FinTechColors.success.main).toBe(FinTechColors.earnings);
    });

    it('error and debit should be the same', () => {
      expect(FinTechColors.error.main).toBe(FinTechColors.debit);
    });

    it('credit should equal earnings', () => {
      expect(FinTechColors.credit).toBe(FinTechColors.earnings);
    });

    it('failure should equal debit', () => {
      expect(FinTechColors.failure).toBe(FinTechColors.debit);
    });
  });

  describe('Spacing System', () => {
    it('should have consistent spacing values', () => {
      expect(FinTechTypography.largeNumber.fontSize).toBeDefined();
      expect(FinTechTypography.importantNumber.fontSize).toBeDefined();
      expect(FinTechTypography.body.fontSize).toBeDefined();
    });
  });
});
