import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { getRawDb } from '../db';
import { getDistributorIdFromUser, getProviderIdFromUser } from '../utils/org-lookup';

/**
 * Export router for generating CSV exports of financial data
 * Supports ledger history exports with filter respect
 */

export const exportRouter = router({
  /**
   * Export ledger history as CSV
   * Respects all filters: provider, date range, amount range, search term
   * Returns CSV content as string
   */
  ledgerHistoryCSV: protectedProcedure
    .input(
      z.object({
        providerId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        amountMin: z.number().optional(),
        amountMax: z.number().optional(),
        searchTerm: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rawDb = await getRawDb();
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        // Build query to fetch all ledger entries matching filters
        let query = `
          SELECT 
            pdl.id,
            pdl.provider_id,
            sp.name as provider_name,
            pdl.distributor_id,
            pdl.type,
            pdl.reference_type,
            pdl.amount,
            pdl.balance_after_transaction,
            pdl.used_credit_after_transaction,
            pdl.reference_id,
            pdl.metadata,
            pdl.createdAt
          FROM provider_distributor_ledger pdl
          JOIN service_providers sp ON pdl.provider_id = sp.id
          WHERE pdl.distributor_id = ?
        `;

        const params: any[] = [distributorId];

        // Add provider filter
        if (input.providerId) {
          query += ` AND pdl.provider_id = ?`;
          params.push(input.providerId);
        }

        // Add date range filters
        if (input.dateFrom) {
          query += ` AND pdl.createdAt >= ?`;
          params.push(new Date(input.dateFrom));
        }
        if (input.dateTo) {
          const toDate = new Date(input.dateTo);
          toDate.setHours(23, 59, 59, 999);
          query += ` AND pdl.createdAt <= ?`;
          params.push(toDate);
        }

        // Add amount range filters
        if (input.amountMin !== undefined) {
          query += ` AND pdl.amount >= ?`;
          params.push(input.amountMin);
        }
        if (input.amountMax !== undefined) {
          query += ` AND pdl.amount <= ?`;
          params.push(input.amountMax);
        }

        // Order by date descending
        query += ` ORDER BY pdl.createdAt DESC`;

        // Execute query using raw SQL
        const conn = await rawDb.getConnection();
        const [rows] = await conn.execute(query, params);
        conn.release();

        // Filter by search term in memory (for reference_id, reference_type, provider_name)
        let filteredRows = rows as any[];
        if (input.searchTerm) {
          const searchLower = input.searchTerm.toLowerCase();
          filteredRows = filteredRows.filter(
            (row) =>
              row.reference_id.toLowerCase().includes(searchLower) ||
              row.reference_type.toLowerCase().includes(searchLower) ||
              row.provider_name.toLowerCase().includes(searchLower)
          );
        }

        // Generate CSV
        const csv = generateLedgerCSV(filteredRows);

        return {
          csv,
          recordCount: filteredRows.length,
          filename: `ledger-export-${new Date().toISOString().split('T')[0]}.csv`,
        };
      } catch (error) {
        throw new Error(`Failed to export ledger: ${(error as any).message}`);
      }
    }),

  /**
   * Export transaction history as CSV
   * For provider admin view - shows all transactions for their products
   */
  transactionHistoryCSV: protectedProcedure
    .input(
      z.object({
        distributorId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        amountMin: z.number().optional(),
        amountMax: z.number().optional(),
        searchTerm: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rawDb = await getRawDb();
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        // Build query to fetch all transactions
        let query = `
          SELECT 
            t.id,
            t.provider_id,
            sp.name as provider_name,
            t.distributor_id,
            d.name as distributor_name,
            t.product_id,
            p.display_name as product_name,
            t.card_id,
            t.amount,
            t.commission_amount,
            t.transaction_type,
            t.status,
            t.idempotency_key,
            t.createdAt,
            t.updatedAt
          FROM transactions t
          JOIN service_providers sp ON t.provider_id = sp.id
          JOIN distributors d ON t.distributor_id = d.id
          LEFT JOIN products p ON t.product_id = p.id
          WHERE t.provider_id = ?
        `;

        const params: any[] = [providerId];

        // Add distributor filter
        if (input.distributorId) {
          query += ` AND t.distributor_id = ?`;
          params.push(input.distributorId);
        }

        // Add date range filters
        if (input.dateFrom) {
          query += ` AND t.createdAt >= ?`;
          params.push(new Date(input.dateFrom));
        }
        if (input.dateTo) {
          const toDate = new Date(input.dateTo);
          toDate.setHours(23, 59, 59, 999);
          query += ` AND t.createdAt <= ?`;
          params.push(toDate);
        }

        // Add amount range filters
        if (input.amountMin !== undefined) {
          query += ` AND t.amount >= ?`;
          params.push(input.amountMin);
        }
        if (input.amountMax !== undefined) {
          query += ` AND t.amount <= ?`;
          params.push(input.amountMax);
        }

        // Order by date descending
        query += ` ORDER BY t.createdAt DESC`;

        // Execute query using raw SQL
        const conn = await rawDb.getConnection();
        const [rows] = await conn.execute(query, params);
        conn.release();

        // Filter by search term in memory
        let filteredRows = rows as any[];
        if (input.searchTerm) {
          const searchLower = input.searchTerm.toLowerCase();
          filteredRows = filteredRows.filter(
            (row) =>
              row.idempotency_key.toLowerCase().includes(searchLower) ||
              row.distributor_name.toLowerCase().includes(searchLower) ||
              row.product_name?.toLowerCase().includes(searchLower) ||
              row.transaction_type.toLowerCase().includes(searchLower)
          );
        }

        // Generate CSV
        const csv = generateTransactionCSV(filteredRows);

        return {
          csv,
          recordCount: filteredRows.length,
          filename: `transactions-export-${new Date().toISOString().split('T')[0]}.csv`,
        };
      } catch (error) {
        throw new Error(`Failed to export transactions: ${(error as any).message}`);
      }
    }),
});

/**
 * Generate CSV for ledger entries
 */
function generateLedgerCSV(rows: any[]): string {
  const headers = [
    'Date & Time',
    'Provider',
    'Type',
    'Reference Type',
    'Reference ID',
    'Amount',
    'Balance After',
    'Used Credit After',
  ];

  const csvRows = rows.map((row) => [
    new Date(row.createdAt).toLocaleString('en-US'),
    row.provider_name,
    row.type,
    row.reference_type,
    row.reference_id,
    row.amount.toFixed(2),
    row.balance_after_transaction.toFixed(2),
    row.used_credit_after_transaction.toFixed(2),
  ]);

  return generateCSVContent(headers, csvRows);
}

/**
 * Generate CSV for transactions
 */
function generateTransactionCSV(rows: any[]): string {
  const headers = [
    'Date & Time',
    'Distributor',
    'Product',
    'Card ID',
    'Amount',
    'Commission',
    'Type',
    'Status',
    'Reference ID',
  ];

  const csvRows = rows.map((row) => [
    new Date(row.createdAt).toLocaleString('en-US'),
    row.distributor_name,
    row.product_name || 'N/A',
    row.card_id,
    row.amount.toFixed(2),
    row.commission_amount.toFixed(2),
    row.transaction_type,
    row.status,
    row.idempotency_key,
  ]);

  return generateCSVContent(headers, csvRows);
}

/**
 * Generate CSV content from headers and rows
 * Handles proper CSV escaping and formatting
 */
function generateCSVContent(headers: string[], rows: string[][]): string {
  const escapedHeaders = headers.map(escapeCSVField);
  const escapedRows = rows.map((row) => row.map(escapeCSVField).join(','));

  return [escapedHeaders.join(','), ...escapedRows].join('\n');
}

/**
 * Escape CSV field values
 * Handles quotes, commas, and newlines
 */
function escapeCSVField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return stringField;
}
