import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { transactions, distributors, products } from "../../drizzle/schema";
import { eq, and, count, sum, desc, gte, lte, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getProviderIdFromUser } from "../utils/org-lookup";

export const providerTransactionsRouter = router({
  /**
   * provider.transactions.list
   * Returns paginated transactions for the authenticated provider
   * Includes filters for date range, distributor, product, status, and amount range
   */
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(100).default(20),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        distributorId: z.number().int().optional(),
        productId: z.number().int().optional(),
        status: z.enum(["pending", "completed", "failed", "refunded"]).optional(),
        minAmount: z.number().nonnegative().optional(),
        maxAmount: z.number().nonnegative().optional(),
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        // Build filter conditions
        const conditions = [eq(transactions.providerId, providerId)];

        if (input.startDate) {
          conditions.push(gte(transactions.createdAt, input.startDate));
        }
        if (input.endDate) {
          const endOfDay = new Date(input.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          conditions.push(lte(transactions.createdAt, endOfDay));
        }
        if (input.distributorId) {
          conditions.push(eq(transactions.distributorId, input.distributorId));
        }
        if (input.productId) {
          conditions.push(eq(transactions.productId, input.productId));
        }
        if (input.status) {
          conditions.push(eq(transactions.status, input.status));
        }
        if (input.minAmount !== undefined) {
          conditions.push(gte(transactions.amount, input.minAmount.toString()));
        }
        if (input.maxAmount !== undefined) {
          conditions.push(lte(transactions.amount, input.maxAmount.toString()));
        }
        // Search by idempotency key (transaction reference)
        if (input.searchQuery) {
          conditions.push(like(transactions.idempotencyKey, `%${input.searchQuery}%`));
        }

        // Get total count
        const countResult = await db
          .select({ count: count() })
          .from(transactions)
          .where(and(...conditions));
        const total = countResult[0]?.count || 0;

        // Get paginated transactions with related data
        const offset = (input.page - 1) * input.limit;
        const txns = await db
          .select({
            id: transactions.id,
            idempotencyKey: transactions.idempotencyKey,
            distributorId: transactions.distributorId,
            providerId: transactions.providerId,
            productId: transactions.productId,
            cardId: transactions.cardId,
            amount: transactions.amount,
            commissionAmount: transactions.commissionAmount,
            transactionType: transactions.transactionType,
            status: transactions.status,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
            distributorName: distributors.name,
            productName: products.name,
            productFaceValue: products.faceValue,
            productCurrency: products.currency,
          })
          .from(transactions)
          .leftJoin(distributors, eq(transactions.distributorId, distributors.id))
          .leftJoin(products, eq(transactions.productId, products.id))
          .where(and(...conditions))
          .orderBy(desc(transactions.createdAt))
          .limit(input.limit)
          .offset(offset);

        return {
          data: txns,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            totalPages: Math.ceil(total / input.limit),
          },
        };
      } catch (error) {
        console.error("[Provider Transactions] Error fetching transactions:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch transactions",
        });
      }
    }),

  /**
   * provider.transactions.summary
   * Returns summary statistics for provider transactions
   */
  summary: protectedProcedure
    .input(
      z.object({
        startDate:     z.date().optional(),
        endDate:       z.date().optional(),
        distributorId: z.number().int().optional(),
        productId:     z.number().int().optional(),
        status:        z.enum(['completed', 'pending', 'failed', 'refunded']).optional(),
        minAmount:     z.number().optional(),
        maxAmount:     z.number().optional(),
        searchQuery:   z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const conditions = [eq(transactions.providerId, providerId)];

        if (input.startDate) {
          conditions.push(gte(transactions.createdAt, input.startDate));
        }
        if (input.endDate) {
          const endOfDay = new Date(input.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          conditions.push(lte(transactions.createdAt, endOfDay));
        }
        if (input.distributorId) {
          conditions.push(eq(transactions.distributorId, input.distributorId));
        }
        if (input.productId) {
          conditions.push(eq(transactions.productId, input.productId));
        }
        if (input.minAmount !== undefined) {
          conditions.push(gte(transactions.amount, String(input.minAmount)));
        }
        if (input.maxAmount !== undefined) {
          conditions.push(lte(transactions.amount, String(input.maxAmount)));
        }
        if (input.searchQuery) {
          conditions.push(like(transactions.idempotencyKey, `%${input.searchQuery}%`));
        }

        // Apply status filter if set; otherwise default to completed for revenue totals
        const statusFilter = input.status
          ? eq(transactions.status, input.status)
          : eq(transactions.status, "completed");

        // Get summary statistics
        const summaryData = await db
          .select({
            totalSales: sum(transactions.amount),
            totalCommission: sum(transactions.commissionAmount),
            successfulCount: count(transactions.id),
          })
          .from(transactions)
          .where(and(and(...conditions), statusFilter));

        // Get failed transaction count (unaffected by status filter so it's always correct)
        const failedData = await db
          .select({
            failedCount: count(transactions.id),
          })
          .from(transactions)
          .where(and(and(...conditions), eq(transactions.status, "failed")));

        return {
          totalSales: summaryData[0]?.totalSales ? parseFloat(summaryData[0].totalSales.toString()) : 0,
          totalCommission: summaryData[0]?.totalCommission ? parseFloat(summaryData[0].totalCommission.toString()) : 0,
          successfulTransactions: summaryData[0]?.successfulCount || 0,
          failedTransactions: failedData[0]?.failedCount || 0,
        };
      } catch (error) {
        console.error("[Provider Transactions] Error fetching summary:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch transaction summary",
        });
      }
    }),

  /**
   * provider.transactions.getDistributors
   * Returns list of distributors for the authenticated provider (for filter dropdown)
   */
  getDistributors: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const providerId = await getProviderIdFromUser(ctx.user.id);
    if (!db) throw new Error("Database connection not available");

    try {
      // Get unique distributors from transactions
      const dists = await db
        .selectDistinct({
          id: distributors.id,
          name: distributors.name,
        })
        .from(transactions)
        .leftJoin(distributors, eq(transactions.distributorId, distributors.id))
        .where(eq(transactions.providerId, providerId))
        .orderBy(distributors.name);

      return dists.filter((d) => d.id !== null);
    } catch (error) {
      console.error("[Provider Transactions] Error fetching distributors:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch distributors",
      });
    }
  }),

  /**
   * provider.transactions.getProducts
   * Returns list of products for the authenticated provider (for filter dropdown)
   */
  getProducts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const providerId = await getProviderIdFromUser(ctx.user.id);
    if (!db) throw new Error("Database connection not available");

    try {
      // Get unique products from transactions
      const prods = await db
        .selectDistinct({
          id: products.id,
          name: products.name,
          faceValue: products.faceValue,
          currency: products.currency,
        })
        .from(transactions)
        .leftJoin(products, eq(transactions.productId, products.id))
        .where(eq(transactions.providerId, providerId))
        .orderBy(products.name);

      return prods.filter((p) => p.id !== null);
    } catch (error) {
      console.error("[Provider Transactions] Error fetching products:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch products",
      });
    }
  }),

  /**
   * provider.transactions.getDetail
   * Returns detailed information for a specific transaction including ledger entries
   */
  getDetail: protectedProcedure
    .input(z.object({ transactionId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const txn = await db
          .select({
            id: transactions.id,
            idempotencyKey: transactions.idempotencyKey,
            distributorId: transactions.distributorId,
            providerId: transactions.providerId,
            productId: transactions.productId,
            cardId: transactions.cardId,
            amount: transactions.amount,
            commissionAmount: transactions.commissionAmount,
            transactionType: transactions.transactionType,
            status: transactions.status,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
            distributorName: distributors.name,
            productName: products.name,
            productFaceValue: products.faceValue,
            productCurrency: products.currency,
          })
          .from(transactions)
          .leftJoin(distributors, eq(transactions.distributorId, distributors.id))
          .leftJoin(products, eq(transactions.productId, products.id))
          .where(and(eq(transactions.id, input.transactionId), eq(transactions.providerId, providerId)))
          .limit(1);

        if (txn.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found",
          });
        }

        return txn[0];
      } catch (error) {
        console.error("[Provider Transactions] Error fetching transaction detail:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch transaction detail",
        });
      }
    }),
});
