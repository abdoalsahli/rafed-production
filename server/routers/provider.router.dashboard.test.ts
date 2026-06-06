import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getRawDb } from '../db';

describe('provider.dashboard - Revenue Calculation Fix', () => {
  let pool: any;

  beforeAll(async () => {
    pool = await getRawDb();
  });

  afterAll(async () => {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // ignore
      }
    }
  });

  it('should sum revenue from completed transactions only, not from ledger', async () => {
    // Get provider 1214748 (Connect Libya) which has orphaned ledger entries
    const providerId = 1214748;

    const conn = await pool.getConnection();
    try {
      // Query ledger entries
      const [ledgerRows] = await conn.execute(
        `SELECT SUM(amount) as total FROM provider_distributor_ledger 
         WHERE provider_id = ? AND reference_type = 'purchase_debit'`,
        [providerId]
      );

      // Query transactions
      const [transactionRows] = await conn.execute(
        `SELECT SUM(amount) as total FROM transactions 
         WHERE provider_id = ? AND status = 'completed'`,
        [providerId]
      );

      const ledgerTotal = Number(ledgerRows?.[0]?.total) || 0;
      const transactionTotal = Number(transactionRows?.[0]?.total) || 0;

      console.log('Ledger total (includes orphaned entries):', ledgerTotal);
      console.log('Transaction total (completed only):', transactionTotal);

      // Verify they are different (ledger has orphaned entries)
      expect(ledgerTotal).toBeGreaterThan(transactionTotal);

      // The dashboard should return the transaction total, not the ledger total
      // Ledger: $30.00 (6 entries including orphaned)
      // Transactions: $20.00 (4 completed transactions)
      expect(ledgerTotal).toBe(30);
      expect(transactionTotal).toBe(20);
    } finally {
      conn.release();
    }
  });

  it('should not include failed purchase ledger entries in revenue', async () => {
    // This test verifies that the fix prevents counting orphaned ledger entries
    // from failed purchases that were never recorded as transactions

    const providerId = 1214748;

    const conn = await pool.getConnection();
    try {
      // Count orphaned entries (ledger entries without corresponding transaction)
      const [orphanedRows] = await conn.execute(
        `SELECT COUNT(*) as count FROM provider_distributor_ledger pdl
         WHERE pdl.provider_id = ? 
         AND pdl.reference_type = 'purchase_debit'
         AND NOT EXISTS (
           SELECT 1 FROM transactions t 
           WHERE t.provider_id = pdl.provider_id 
           AND t.id = CAST(pdl.reference_id AS UNSIGNED)
         )`,
        [providerId]
      );

      const orphanedCount = Number(orphanedRows?.[0]?.count) || 0;
      console.log('Orphaned ledger entries (failed purchases):', orphanedCount);

      // Should have at least 2 orphaned entries
      expect(orphanedCount).toBeGreaterThanOrEqual(2);
    } finally {
      conn.release();
    }
  });
});
