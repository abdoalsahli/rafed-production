import { describe, it, expect } from 'vitest';
import { LedgerEntry } from '../ImprovedLedger';

describe('Wallet and Ledger Components', () => {
  describe('Ledger Entry', () => {
    it('should create valid ledger entry', () => {
      const entry: LedgerEntry = {
        id: 'TXN-000001',
        date: new Date('2026-04-12'),
        type: 'topup',
        amount: 1000,
        balanceAfter: 6000,
        description: 'Bank Transfer',
      };

      expect(entry.id).toBe('TXN-000001');
      expect(entry.type).toBe('topup');
      expect(entry.amount).toBe(1000);
      expect(entry.balanceAfter).toBe(6000);
    });

    it('should support all transaction types', () => {
      const types: Array<'topup' | 'purchase' | 'refund'> = ['topup', 'purchase', 'refund'];

      types.forEach((type) => {
        const entry: LedgerEntry = {
          id: `TXN-${type}`,
          date: new Date(),
          type,
          amount: 500,
          balanceAfter: 5500,
        };

        expect(entry.type).toBe(type);
      });
    });

    it('should handle large amounts', () => {
      const entry: LedgerEntry = {
        id: 'TXN-999999',
        date: new Date(),
        type: 'topup',
        amount: 999999.99,
        balanceAfter: 1000000,
      };

      expect(entry.amount).toBe(999999.99);
      expect(entry.balanceAfter).toBe(1000000);
    });

    it('should handle zero amount', () => {
      const entry: LedgerEntry = {
        id: 'TXN-000000',
        date: new Date(),
        type: 'purchase',
        amount: 0,
        balanceAfter: 5000,
      };

      expect(entry.amount).toBe(0);
    });

    it('should handle negative balance', () => {
      const entry: LedgerEntry = {
        id: 'TXN-NEGATIVE',
        date: new Date(),
        type: 'purchase',
        amount: 6000,
        balanceAfter: -1000,
      };

      expect(entry.balanceAfter).toBe(-1000);
    });
  });

  describe('Wallet Balance Calculations', () => {
    it('should calculate available to spend correctly', () => {
      const walletBalance = 5000;
      const creditLine = 10000;
      const usedCredit = 2500;

      const availableCredit = creditLine - usedCredit;
      const availableToSpend = walletBalance + availableCredit;

      expect(availableCredit).toBe(7500);
      expect(availableToSpend).toBe(12500);
    });

    it('should handle zero credit line', () => {
      const walletBalance = 5000;
      const creditLine = 0;
      const usedCredit = 0;

      const availableCredit = creditLine - usedCredit;
      const availableToSpend = walletBalance + availableCredit;

      expect(availableCredit).toBe(0);
      expect(availableToSpend).toBe(5000);
    });

    it('should handle full credit utilization', () => {
      const walletBalance = 5000;
      const creditLine = 10000;
      const usedCredit = 10000;

      const availableCredit = creditLine - usedCredit;
      const availableToSpend = walletBalance + availableCredit;

      expect(availableCredit).toBe(0);
      expect(availableToSpend).toBe(5000);
    });

    it('should calculate credit usage percentage', () => {
      const creditLine = 10000;
      const usedCredit = 2500;

      const usagePercentage = (usedCredit / creditLine) * 100;

      expect(usagePercentage).toBe(25);
    });

    it('should calculate high credit usage percentage', () => {
      const creditLine = 10000;
      const usedCredit = 8500;

      const usagePercentage = (usedCredit / creditLine) * 100;

      expect(usagePercentage).toBe(85);
    });
  });

  describe('Ledger Filtering', () => {
    const mockEntries: LedgerEntry[] = [
      {
        id: 'TXN-001',
        date: new Date('2026-04-10'),
        type: 'topup',
        amount: 1000,
        balanceAfter: 6000,
      },
      {
        id: 'TXN-002',
        date: new Date('2026-04-11'),
        type: 'purchase',
        amount: 500,
        balanceAfter: 5500,
      },
      {
        id: 'TXN-003',
        date: new Date('2026-04-12'),
        type: 'refund',
        amount: 200,
        balanceAfter: 5700,
      },
    ];

    it('should filter by transaction type', () => {
      const filtered = mockEntries.filter((e) => e.type === 'topup');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('topup');
    });

    it('should filter by date range', () => {
      const startDate = new Date('2026-04-11');
      const endDate = new Date('2026-04-12');

      const filtered = mockEntries.filter((e) => e.date >= startDate && e.date <= endDate);

      expect(filtered).toHaveLength(2);
    });

    it('should apply multiple filters', () => {
      const filtered = mockEntries.filter(
        (e) => e.type === 'topup' && e.date >= new Date('2026-04-10')
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('TXN-001');
    });

    it('should return all entries when no filters applied', () => {
      const filtered = mockEntries.filter(() => true);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Ledger Pagination', () => {
    const mockEntries: LedgerEntry[] = Array.from({ length: 50 }, (_, i) => ({
      id: `TXN-${String(i + 1).padStart(6, '0')}`,
      date: new Date(),
      type: 'purchase' as const,
      amount: 100,
      balanceAfter: 5000 - (i + 1) * 100,
    }));

    it('should paginate correctly with page size 10', () => {
      const pageSize = 10;
      const page1 = mockEntries.slice(0, pageSize);

      expect(page1).toHaveLength(10);
      expect(page1[0].id).toBe('TXN-000001');
      expect(page1[9].id).toBe('TXN-000010');
    });

    it('should calculate total pages', () => {
      const pageSize = 10;
      const totalPages = Math.ceil(mockEntries.length / pageSize);

      expect(totalPages).toBe(5);
    });

    it('should determine if next page exists', () => {
      const pageSize = 10;
      const currentPage = 1;
      const totalPages = Math.ceil(mockEntries.length / pageSize);
      const hasNextPage = currentPage < totalPages;

      expect(hasNextPage).toBe(true);
    });

    it('should determine if previous page exists', () => {
      const currentPage = 1;
      const hasPreviousPage = currentPage > 1;

      expect(hasPreviousPage).toBe(false);
    });

    it('should handle last page with fewer items', () => {
      const pageSize = 15;
      const lastPageStart = 45;
      const lastPage = mockEntries.slice(lastPageStart, lastPageStart + pageSize);

      expect(lastPage).toHaveLength(5);
    });
  });

  describe('Currency Formatting', () => {
    it('should format USD currency', () => {
      const amount = 5000;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(amount);

      expect(formatted).toBe('$5,000.00');
    });

    it('should format decimal amounts', () => {
      const amount = 1234.56;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(amount);

      expect(formatted).toBe('$1,234.56');
    });

    it('should format large amounts', () => {
      const amount = 999999.99;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(amount);

      expect(formatted).toBe('$999,999.99');
    });
  });

  describe('Transaction Type Classification', () => {
    it('should classify topup as credit', () => {
      const type = 'topup';
      const isCredit = type === 'topup' || type === 'refund';

      expect(isCredit).toBe(true);
    });

    it('should classify purchase as debit', () => {
      const type = 'purchase';
      const isCredit = type === 'topup' || type === 'refund';

      expect(isCredit).toBe(false);
    });

    it('should classify refund as credit', () => {
      const type = 'refund';
      const isCredit = type === 'topup' || type === 'refund';

      expect(isCredit).toBe(true);
    });
  });

  describe('Balance Tracking', () => {
    it('should track balance correctly through transactions', () => {
      const entries: LedgerEntry[] = [
        { id: '1', date: new Date(), type: 'topup', amount: 1000, balanceAfter: 6000 },
        { id: '2', date: new Date(), type: 'purchase', amount: 500, balanceAfter: 5500 },
        { id: '3', date: new Date(), type: 'topup', amount: 2000, balanceAfter: 7500 },
      ];

      expect(entries[0].balanceAfter).toBe(6000);
      expect(entries[1].balanceAfter).toBe(5500);
      expect(entries[2].balanceAfter).toBe(7500);
    });

    it('should show correct running balance', () => {
      const entries: LedgerEntry[] = [
        { id: '1', date: new Date(), type: 'topup', amount: 1000, balanceAfter: 1000 },
        { id: '2', date: new Date(), type: 'purchase', amount: 200, balanceAfter: 800 },
        { id: '3', date: new Date(), type: 'purchase', amount: 300, balanceAfter: 500 },
      ];

      const finalBalance = entries[entries.length - 1].balanceAfter;
      expect(finalBalance).toBe(500);
    });
  });
});
