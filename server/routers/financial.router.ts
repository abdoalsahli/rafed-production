import { logPerfData } from '../utils/dashboard-perf';
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  providerDistributorAccounts,
  providerDistributorLedger,
  serviceProviders,
  monitoringAlerts,
  providerDistributorRelationships,
} from "../../drizzle/schema";
import { eq, and, desc, sum, count, min, max, like, gte, lte, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { z } from "zod";
import { getDistributorIdFromUser } from "../utils/org-lookup";

/**
 * Financial Router - Distributor-scoped financial endpoints
 * 
 * Provides read-only access to:
 * - Account balances per provider
 * - Ledger history per provider
 * - Alerts relevant to distributor
 */

export const financialRouter = router({
  /**
   * Get authenticated distributor's account balances across all providers
   * 
   * Returns:
   * - Array of accounts (one per provider relationship)
   * - Each account includes: providerId, providerName, balance, creditLine, usedCredit, availableToSpend
   * - Optional aggregate summary
   */
  accountBalance: protectedProcedure.query(async ({ ctx }) => {
    const queryStartTime = Date.now(); // TIMING: Start measurement
    let distributorId = ctx.user?.id || 0; // fallback
    try {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User must be authenticated",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

        distributorId = await getDistributorIdFromUser(ctx.user.id);

      // Get all accounts for this distributor across all providers
      const accounts = await db
        .select({
          id: providerDistributorAccounts.id,
          providerId: providerDistributorAccounts.providerId,
          balance: providerDistributorAccounts.balance,
          creditLine: providerDistributorAccounts.creditLine,
          usedCredit: providerDistributorAccounts.usedCredit,
          providerName: serviceProviders.name,
        })
        .from(providerDistributorAccounts)
        .leftJoin(
          serviceProviders,
          eq(providerDistributorAccounts.providerId, serviceProviders.id)
        )
        .where(eq(providerDistributorAccounts.distributorId, distributorId));

      // Transform to include calculated fields
      const accountsWithCalculations = accounts.map((acc: any) => {
        const balance = new Decimal(acc.balance);
        const creditLine = new Decimal(acc.creditLine);
        const usedCredit = new Decimal(acc.usedCredit);
        const availableToSpend = balance.plus(creditLine.minus(usedCredit));

        return {
          providerId: acc.providerId,
          providerName: acc.providerName || "Unknown Provider",
          balance: balance.toNumber(),
          creditLine: creditLine.toNumber(),
          usedCredit: usedCredit.toNumber(),
          availableToSpend: availableToSpend.toNumber(),
        };
      });

      // Calculate aggregate summary
      let totalBalance = new Decimal(0);
      let totalUsedCredit = new Decimal(0);
      let totalAvailableToSpend = new Decimal(0);

      for (const acc of accountsWithCalculations) {
        totalBalance = totalBalance.plus(acc.balance);
        totalUsedCredit = totalUsedCredit.plus(acc.usedCredit);
        totalAvailableToSpend = totalAvailableToSpend.plus(acc.availableToSpend);
      }

      // TIMING: Log execution time
      const queryEndTime = Date.now();
      const executionTimeMs = queryEndTime - queryStartTime;
      logPerfData({
        procedure: 'financial.accountBalance',
        userId: ctx.user.id,
        distributorId,
        durationMs: executionTimeMs,
        rowCount: accountsWithCalculations.length,
        success: true,
      });

      return {
        accounts: accountsWithCalculations,
        summary: {
          totalBalance: totalBalance.toNumber(),
          totalUsedCredit: totalUsedCredit.toNumber(),
          totalAvailableToSpend: totalAvailableToSpend.toNumber(),
        },
      };
    } catch (error) {
      logPerfData({
        procedure: 'financial.accountBalance',
        userId: ctx.user.id,
        distributorId,
        durationMs: Date.now() - queryStartTime,
        rowCount: 0,
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
      });
      console.error("[Financial Router] Error getting account balance:", error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to get account balance",
      });
    }
  }),

  /**
   * Get authenticated distributor's ledger history
   * 
   * Supports:
   * - limit: 1-100 (default 50)
   * - offset: 0+ (default 0)
   * - providerId: optional filter for specific provider
   * 
   * Returns:
   * - Array of ledger entries with full transaction details
   */
  ledgerHistory: protectedProcedure
    .input(
      z.object({
        limit:      z.number().min(1).max(100).default(50),
        offset:     z.number().min(0).default(0),
        providerId: z.number().optional(),
        dateFrom:   z.string().optional(),
        dateTo:     z.string().optional(),
        amountMin:  z.number().optional(),
        amountMax:  z.number().optional(),
        searchTerm: z.string().max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const queryStartTime = Date.now(); // TIMING: Start measurement
      let distributorId = ctx.user?.id || 0; // fallback
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User must be authenticated",
          });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection not available",
          });
        }

        distributorId = await getDistributorIdFromUser(ctx.user.id);

        // Build WHERE clause
        const whereConditions = [eq(providerDistributorLedger.distributorId, distributorId)];

        if (input.providerId) {
          whereConditions.push(eq(providerDistributorLedger.providerId, input.providerId));
        }
        if (input.dateFrom) {
          whereConditions.push(gte(providerDistributorLedger.createdAt, new Date(input.dateFrom)));
        }
        if (input.dateTo) {
          const end = new Date(input.dateTo);
          end.setHours(23, 59, 59, 999);
          whereConditions.push(lte(providerDistributorLedger.createdAt, end));
        }
        if (input.amountMin !== undefined) {
          whereConditions.push(gte(providerDistributorLedger.amount, String(input.amountMin)));
        }
        if (input.amountMax !== undefined) {
          whereConditions.push(lte(providerDistributorLedger.amount, String(input.amountMax)));
        }
        if (input.searchTerm) {
          whereConditions.push(like(providerDistributorLedger.referenceId, `%${input.searchTerm}%`));
        }

        // Only show purchase entries — commissions are internal accounting,
        // not transactions the distributor initiated.
        const purchaseConditions = [...whereConditions, eq(providerDistributorLedger.referenceType, "purchase_debit")];

        // Run entries query and total count query in parallel
        const [entries, [{ total }]] = await Promise.all([
          db
            .select({
              id: providerDistributorLedger.id,
              providerId: providerDistributorLedger.providerId,
              providerName: serviceProviders.name,
              type: providerDistributorLedger.type,
              referenceType: providerDistributorLedger.referenceType,
              amount: providerDistributorLedger.amount,
              balanceAfterTransaction: providerDistributorLedger.balanceAfterTransaction,
              usedCreditAfterTransaction: providerDistributorLedger.usedCreditAfterTransaction,
              referenceId: providerDistributorLedger.referenceId,
              metadata: providerDistributorLedger.metadata,
              createdAt: providerDistributorLedger.createdAt,
            })
            .from(providerDistributorLedger)
            .leftJoin(
              serviceProviders,
              eq(providerDistributorLedger.providerId, serviceProviders.id)
            )
            .where(and(...purchaseConditions))
            .orderBy(desc(providerDistributorLedger.createdAt))
            .limit(input.limit)
            .offset(input.offset),
          db
            .select({ total: count() })
            .from(providerDistributorLedger)
            .where(and(...purchaseConditions)),
        ]);

        // TIMING: Log execution time
        const queryEndTime = Date.now();
        const executionTimeMs = queryEndTime - queryStartTime;
        logPerfData({
          procedure: 'financial.ledgerHistory',
          userId: ctx.user.id,
          distributorId,
          durationMs: executionTimeMs,
          rowCount: entries.length,
          success: true,
        });

        // Transform to include calculated fields and proper types
        return {
          total,
          entries: entries.map((entry: any) => ({
            id: entry.id,
            providerId: entry.providerId,
            providerName: entry.providerName || "Unknown Provider",
            type: entry.type,
            referenceType: entry.referenceType,
            amount: new Decimal(entry.amount).toNumber(),
            balanceAfterTransaction: new Decimal(entry.balanceAfterTransaction).toNumber(),
            usedCreditAfterTransaction: new Decimal(entry.usedCreditAfterTransaction).toNumber(),
            referenceId: entry.referenceId,
            metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
            createdAt: entry.createdAt,
          })),
        };
      } catch (error) {
        logPerfData({
          procedure: 'financial.ledgerHistory',
          userId: ctx.user.id,
          distributorId,
          durationMs: Date.now() - queryStartTime,
          rowCount: 0,
          success: false,
          errorCode: 'INTERNAL_SERVER_ERROR',
        });
        console.error("[Financial Router] Error getting ledger history:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get ledger history",
        });
      }
    }),

  /**
   * Aggregate totals for the distributor's ledger across ALL pages.
   * Used to power stat-cards that must reflect the full dataset, not
   * just the current page.
   *
   * Optional filter: providerId (same as ledgerHistory)
   */
  ledgerSummary: protectedProcedure
    .input(
      z.object({
        providerId: z.number().optional(),
        dateFrom:   z.string().optional(),
        dateTo:     z.string().optional(),
        amountMin:  z.number().optional(),
        amountMax:  z.number().optional(),
        searchTerm: z.string().max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "User must be authenticated" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection not available" });

        const distributorId = await getDistributorIdFromUser(ctx.user.id);

        const whereConditions = [eq(providerDistributorLedger.distributorId, distributorId)];
        if (input.providerId) {
          whereConditions.push(eq(providerDistributorLedger.providerId, input.providerId));
        }
        if (input.dateFrom) {
          whereConditions.push(gte(providerDistributorLedger.createdAt, new Date(input.dateFrom)));
        }
        if (input.dateTo) {
          const end = new Date(input.dateTo);
          end.setHours(23, 59, 59, 999);
          whereConditions.push(lte(providerDistributorLedger.createdAt, end));
        }
        if (input.amountMin !== undefined) {
          whereConditions.push(gte(providerDistributorLedger.amount, String(input.amountMin)));
        }
        if (input.amountMax !== undefined) {
          whereConditions.push(lte(providerDistributorLedger.amount, String(input.amountMax)));
        }
        if (input.searchTerm) {
          whereConditions.push(like(providerDistributorLedger.referenceId, `%${input.searchTerm}%`));
        }

        // Run both aggregations in parallel
        // totalAmount  = purchases only (purchase_debit) — commissions excluded
        // totalCommission = commission credits only
        const [totalResult, commissionResult] = await Promise.all([
          db
            .select({ total: sum(providerDistributorLedger.amount) })
            .from(providerDistributorLedger)
            .where(and(...whereConditions, eq(providerDistributorLedger.referenceType, "purchase_debit"))),
          db
            .select({ total: sum(providerDistributorLedger.amount) })
            .from(providerDistributorLedger)
            .where(and(...whereConditions, like(providerDistributorLedger.referenceType, '%commission%'))),
        ]);

        return {
          totalAmount:     parseFloat(totalResult[0]?.total     || '0'),
          totalCommission: parseFloat(commissionResult[0]?.total || '0'),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get ledger summary",
        });
      }
    }),

  /**
   * Get alerts relevant to authenticated distributor
   *
   * Returns alerts where:
   * - distributorId matches authenticated user
   *
   * Supports:
   * - limit: 1-100 (default 20)
   * - severity: optional filter (critical, warning, info)
   */
  alerts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        severity: z.enum(["critical", "warning", "info"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User must be authenticated",
          });
        }

        const db = await getDb();
        if (!db) {
          // Return empty array if database not available
          return [];
        }

        const distributorId = await getDistributorIdFromUser(ctx.user.id);

        // Build query for distributor-relevant alerts
        const whereConditions = [eq(monitoringAlerts.distributorId, distributorId)];

        if (input.severity) {
          whereConditions.push(eq(monitoringAlerts.severity, input.severity));
        }

        const alerts = await db
          .select()
          .from(monitoringAlerts)
          .where(and(...whereConditions))
          .orderBy(desc(monitoringAlerts.createdAt))
          .limit(input.limit);

        // Transform to include parsed metadata
        return alerts.map((alert: any) => ({
          id: alert.id,
          severity: alert.severity,
          ruleName: alert.ruleName,
          providerId: alert.providerId,
          distributorId: alert.distributorId,
          referenceId: alert.referenceId,
          message: alert.message,
          metadata: alert.metadata ? JSON.parse(alert.metadata) : null,
          status: alert.status,
          createdAt: alert.createdAt,
          resolvedAt: alert.resolvedAt,
        }));
      } catch (error) {
        console.error("[Financial Router] Error getting alerts:", error);

        // Return empty array on error to prevent dashboard from breaking
        console.warn("[Financial Router] Returning empty alerts array due to error");
        return [];
      }
    }),

  /**
   * Get aggregated provider insights for authenticated distributor
   *
   * Returns per-provider analytics:
   * - totalPurchases: sum of purchase debit amounts
   * - totalTransactions: count of purchase transactions
   * - totalCommissionEarned: sum of commission credit amounts
   * - avgCommissionPerTransaction: average commission per purchase
   * - firstTransactionDate: earliest transaction date
   * - lastTransactionDate: most recent transaction date
   * - connectionDate: when provider was connected (from relationship createdAt)
   *
   * Supports:
   * - limit: 1-100 (default 50)
   * - sortBy: 'volume' (default) or 'commission'
   */
  providerInsights: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        sortBy: z.enum(["volume", "commission"]).default("volume"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User must be authenticated",
          });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection not available",
          });
        }

        const distributorId = await getDistributorIdFromUser(ctx.user.id);

        // Get all provider relationships for this distributor to map connectionDate
        const relationships = await db
          .select({
            providerId: providerDistributorRelationships.providerId,
            connectionDate: providerDistributorRelationships.createdAt,
          })
          .from(providerDistributorRelationships)
          .where(eq(providerDistributorRelationships.distributorId, distributorId));

        if (relationships.length === 0) {
          return [];
        }

        const connectionDateMap = new Map(
          relationships.map((r: any) => [r.providerId, r.connectionDate])
        );

        // Get purchase aggregates per provider
        const purchaseData = await db
          .select({
            providerId: providerDistributorLedger.providerId,
            totalPurchases: sum(providerDistributorLedger.amount),
            totalTransactions: count(providerDistributorLedger.id),
            firstTransactionDate: min(providerDistributorLedger.createdAt),
            lastTransactionDate: max(providerDistributorLedger.createdAt),
          })
          .from(providerDistributorLedger)
          .where(
            and(
              eq(providerDistributorLedger.distributorId, distributorId),
              eq(providerDistributorLedger.referenceType, "purchase_debit")
            )
          )
          .groupBy(providerDistributorLedger.providerId);

        // Get commission data per provider
        const commissionData = await db
          .select({
            providerId: providerDistributorLedger.providerId,
            totalCommission: sum(providerDistributorLedger.amount),
          })
          .from(providerDistributorLedger)
          .where(
            and(
              eq(providerDistributorLedger.distributorId, distributorId),
              eq(providerDistributorLedger.referenceType, "commission_credit")
            )
          )
          .groupBy(providerDistributorLedger.providerId);

        const commissionMap = new Map(
          commissionData.map((c: any) => [c.providerId, new Decimal(c.totalCommission || 0)])
        );

        // Get provider names
        const providerIds = relationships.map((r: any) => r.providerId);
        const providers = await db
          .select({
            id: serviceProviders.id,
            name: serviceProviders.name,
          })
          .from(serviceProviders);

        const providerNameMap = new Map(
          providers.map((p: any) => [p.id, p.name])
        );

        // Build response with insights
        const insights = purchaseData.map((data: any) => {
          const providerId = data.providerId;
          const totalPurchases = new Decimal(data.totalPurchases || 0);
          const totalTransactions = data.totalTransactions || 0;
          const totalCommission = commissionMap.get(providerId) || new Decimal(0);
          const avgCommission =
            totalTransactions > 0
              ? totalCommission.dividedBy(totalTransactions)
              : new Decimal(0);

          return {
            providerId,
            providerName: providerNameMap.get(providerId) || "Unknown Provider",
            totalPurchases: totalPurchases.toNumber(),
            totalTransactions,
            totalCommissionEarned: totalCommission.toNumber(),
            avgCommissionPerTransaction: avgCommission.toNumber(),
            firstTransactionDate: data.firstTransactionDate || null,
            lastTransactionDate: data.lastTransactionDate || null,
            connectionDate: connectionDateMap.get(providerId) || null,
          };
        });

        // Sort by requested field
        if (input.sortBy === "commission") {
          insights.sort(
            (a: any, b: any) => b.totalCommissionEarned - a.totalCommissionEarned
          );
        } else {
          // Sort by volume (totalPurchases)
          insights.sort((a: any, b: any) => b.totalPurchases - a.totalPurchases);
        }

        return insights.slice(0, input.limit);
      } catch (error) {
        console.error("[Financial Router] Error getting provider insights:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get provider insights",
        });
      }
    }),
});
