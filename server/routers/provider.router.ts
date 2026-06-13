import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb, getRawDb } from "../db";
import { serviceProviders, distributors, products, cards, accessRequests, providerDistributorRelationships, providerDistributorCommission, providerDistributorAccounts, providerDistributorLedger, cardBatches, transactions, hashPin } from "../../drizzle/schema";
import { getProviderIdFromUser } from "../utils/org-lookup";
import { eq, and, count, sum, desc, gte, lte, or, between, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { topUpService } from "../services/topup.service";
import { pinEncryptionService } from "../services/encryption.service";
import { NotificationService } from "../_core/notification.service";
import { parseCSV, parseXLSX, ParsedCard } from "../utils/file-parser";
import {
  handlePreviewCardUpload,
  handleConfirmCardUpload,
  handleCancelCardUpload,
  previewCardUploadInputSchema,
  confirmCardUploadInputSchema,
  cancelCardUploadInputSchema,
} from "./upload-endpoints";

const LOW_STOCK_THRESHOLD = 100; // Default low-stock threshold for MVP

// Note: PIN encryption now uses centralized service (encryption.service.ts)
// This uses AES-256-GCM (not CBC) for consistency with purchase/decryption flow
// The old encryptPin function has been removed

// Validate PIN format (basic check)
function validatePin(pin: string): boolean {
  return !!(pin && pin.length >= 4 && pin.length <= 32);
}

export const providerRouter = router({
  /**
   * provider.getProviderCode
   * Returns the authenticated provider's unique provider code
   */
  getProviderCode: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");
    const providerId = await getProviderIdFromUser(ctx.user.id);

    try {
      const provider = await db
        .select({ providerCode: serviceProviders.providerCode })
        .from(serviceProviders)
        .where(eq(serviceProviders.id, providerId))
        .limit(1);

      if (provider.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider not found",
        });
      }

      return {
        providerCode: provider[0].providerCode,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch provider code",
      });
    }
  }),

  /**
   * provider.dashboard
   * Returns provider dashboard summary scoped to the authenticated provider.
   * 
   * Includes:
   * - totalRevenue: Sum of all purchase debits
   * - todayRevenue: Sum of purchase debits from today
   * - commissionPaid: Sum of commission credits
   * - activeDistributors: Count of active provider-distributor relationships
   * - pendingRequests: Count of pending access requests
   */
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    // Get provider ID from user's organizations
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");
    const providerId = await getProviderIdFromUser(ctx.user.id);

    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query 1: Total revenue from transactions (only completed purchases)
      // This prevents counting orphaned ledger entries from failed purchases
      const revenueData = await db
        .select({
          totalAmount: sum(transactions.amount),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.providerId, providerId),
            eq(transactions.status, "completed")
          )
        );

      // Query 2: Today's revenue from completed transactions
      const todayRevenueData = await db
        .select({
          totalAmount: sum(transactions.amount),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.providerId, providerId),
            eq(transactions.status, "completed"),
            gte(transactions.createdAt, today),
            lte(transactions.createdAt, tomorrow)
          )
        );

      // Query 3: Commission paid (sum of commission_credit entries)
      const commissionData = await db
        .select({
          totalAmount: sum(providerDistributorLedger.amount),
        })
        .from(providerDistributorLedger)
        .where(
          and(
            eq(providerDistributorLedger.providerId, providerId),
            eq(providerDistributorLedger.referenceType, "commission_credit")
          )
        );

      // Query 4: Active distributors count
      const activeDistributorsData = await db
        .select({
          count: count(),
        })
        .from(providerDistributorRelationships)
        .where(
          and(
            eq(providerDistributorRelationships.providerId, providerId),
            eq(providerDistributorRelationships.status, "active")
          )
        );

      // Query 5: Pending requests count
      const pendingRequestsData = await db
        .select({
          count: count(),
        })
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.providerId, providerId),
            eq(accessRequests.status, "pending")
          )
        );

      // Query 6: Today's cards sold (count of completed transactions today)
      const todayCardsSoldData = await db
        .select({ count: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.providerId, providerId),
            eq(transactions.status, "completed"),
            gte(transactions.createdAt, today),
            lte(transactions.createdAt, tomorrow)
          )
        );

      // Query 7: Total completed transactions ever (total cards sold)
      const totalCardsSoldData = await db
        .select({ count: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.providerId, providerId),
            eq(transactions.status, "completed")
          )
        );

      return {
        totalRevenue:     parseFloat(revenueData[0]?.totalAmount?.toString() || "0"),
        todayRevenue:     parseFloat(todayRevenueData[0]?.totalAmount?.toString() || "0"),
        commissionPaid:   parseFloat(commissionData[0]?.totalAmount?.toString() || "0"),
        activeDistributors: activeDistributorsData[0]?.count || 0,
        pendingRequests:  pendingRequestsData[0]?.count || 0,
        todayCardsSold:   todayCardsSoldData[0]?.count || 0,
        totalCardsSold:   totalCardsSoldData[0]?.count || 0,
      };
    } catch (error) {
      console.error("[Provider Router] Error getting dashboard:", error);
      return {
        totalRevenue: 0,
        todayRevenue: 0,
        commissionPaid: 0,
        activeDistributors: 0,
        pendingRequests: 0,
      };
    }
  }),

  /**
   * provider.recentSales
   * Returns recent provider sales / financial events scoped to the authenticated provider.
   * 
   * Includes:
   * - transactionId
   * - distributorId
   * - distributorName
   * - productId
   * - productName
   * - amount
   * - commissionAmount
   * - status
   * - createdAt
   */
  recentSales: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const sales = await db
          .select({
            transactionId: providerDistributorLedger.id,
            distributorId: providerDistributorLedger.distributorId,
            distributorName: distributors.name,
            amount: providerDistributorLedger.amount,
            referenceType: providerDistributorLedger.referenceType,
            referenceId: providerDistributorLedger.referenceId,
            createdAt: providerDistributorLedger.createdAt,
          })
          .from(providerDistributorLedger)
          .innerJoin(
            distributors,
            eq(providerDistributorLedger.distributorId, distributors.id)
          )
          .where(
            and(
              eq(providerDistributorLedger.providerId, providerId),
              eq(providerDistributorLedger.referenceType, "purchase_debit")
            )
          )
          .orderBy(desc(providerDistributorLedger.createdAt))
          .limit(input.limit);

        return sales.map((sale: any) => ({
          transactionId: sale.transactionId,
          distributorId: sale.distributorId,
          distributorName: sale.distributorName,
          amount: parseFloat(sale.amount.toString()),
          referenceType: sale.referenceType,
          referenceId: sale.referenceId,
          createdAt: sale.createdAt,
        }));
      } catch (error) {
        console.error("[Provider Router] Error getting recent sales:", error);
        return [];
      }
    }),

  /**
   * provider.lowInventoryAlerts
   * Returns provider products with low inventory.
   * 
   * Includes:
   * - productId
   * - productName
   * - availableCards
   * - lowStockThreshold
   * - status
   */
  lowInventoryAlerts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");
    
    const providerId = await getProviderIdFromUser(ctx.user.id);

    try {
      // Get all products for this provider
      const providerProducts = await db
        .select({
          productId: products.id,
          productName: products.name,
        })
        .from(products)
        .where(eq(products.providerId, providerId));

      // For each product, count available cards
      const alerts = [];
      for (const product of providerProducts) {
        const availableCardsData = await db
          .select({
            count: count(),
          })
          .from(cards)
          .where(
            and(
              eq(cards.productId, product.productId),
              eq(cards.status, "AVAILABLE")
            )
          );

        const availableCount = availableCardsData[0]?.count || 0;
        if (availableCount < LOW_STOCK_THRESHOLD) {
          alerts.push({
            productId: product.productId,
            productName: product.productName,
            availableCards: availableCount,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
            status: availableCount === 0 ? "out_of_stock" : "low_stock",
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error("[Provider Router] Error getting low inventory alerts:", error);
      return [];
    }
  }),

  /**
   * provider.pendingRequests
   * Returns pending distributor access requests for the authenticated provider.
   */
  pendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");
    
    const providerId = await getProviderIdFromUser(ctx.user.id);

    try {
      const requests = await db
        .select({
          requestId: accessRequests.id,
          distributorId: accessRequests.distributorId,
          distributorName: distributors.name,
          requestedCommission: accessRequests.requestedCommission,
          requestedCreditLine: accessRequests.requestedCreditLine,
          createdAt: accessRequests.createdAt,
          status: accessRequests.status,
        })
        .from(accessRequests)
        .innerJoin(
          distributors,
          eq(accessRequests.distributorId, distributors.id)
        )
        .where(
          and(
            eq(accessRequests.providerId, providerId),
            eq(accessRequests.status, "pending")
          )
        )
        .orderBy(desc(accessRequests.createdAt));

      return requests.map((req: any) => ({
        requestId: req.requestId,
        distributorId: req.distributorId,
        distributorName: req.distributorName,
        requestedCommission: parseFloat(req.requestedCommission.toString()),
        requestedCreditLine: parseFloat(req.requestedCreditLine.toString()),
        createdAt: req.createdAt,
        status: req.status,
      }));
    } catch (error) {
      console.error("[Provider Router] Error getting pending requests:", error);
      return [];
    }
  }),

  /**
   * provider.activeDistributors
   * Returns active provider-distributor relationships for the authenticated provider.
   */
  activeDistributors: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");
    const providerId = await getProviderIdFromUser(ctx.user.id);

    try {
      const relationships = await db
        .select({
          relationshipId: providerDistributorRelationships.id,
          distributorId: providerDistributorRelationships.distributorId,
          distributorName: distributors.name,
          status: providerDistributorRelationships.status,
          commissionPercentage: providerDistributorRelationships.commissionPercentage,
          creditLine: providerDistributorRelationships.creditLine,
          balance: providerDistributorAccounts.balance,
          usedCredit: providerDistributorAccounts.usedCredit,
          createdAt: providerDistributorRelationships.createdAt,
        })
        .from(providerDistributorRelationships)
        .innerJoin(
          distributors,
          eq(providerDistributorRelationships.distributorId, distributors.id)
        )
        .leftJoin(
          providerDistributorAccounts,
          and(
            eq(providerDistributorAccounts.providerId, providerDistributorRelationships.providerId),
            eq(providerDistributorAccounts.distributorId, providerDistributorRelationships.distributorId)
          )
        )
        .where(eq(providerDistributorRelationships.providerId, providerId))
        .orderBy(desc(providerDistributorRelationships.createdAt));

      return relationships.map((rel: any) => {
        const balance = parseFloat(rel.balance?.toString() ?? "0") || 0;
        const creditLine = parseFloat(rel.creditLine.toString()) || 0;
        const usedCredit = parseFloat(rel.usedCredit?.toString() ?? "0") || 0;
        return {
          relationshipId: rel.relationshipId,
          distributorId: rel.distributorId,
          distributorName: rel.distributorName,
          status: rel.status,
          commissionPercentage: parseFloat(rel.commissionPercentage.toString()) || 0,
          creditLine,
          balance,
          usedCredit,
          availableToSpend: balance + creditLine - usedCredit,
          createdAt: rel.createdAt,
        };
      });
    } catch (error) {
      console.error("[Provider Router] Error getting active distributors:", error);
      return [];
    }
  }),

  /**
   * provider.updateRelationshipTerms
   * Updates commission rate and/or credit line for a distributor relationship.
   */
  updateRelationshipTerms: protectedProcedure
    .input(
      z.object({
        relationshipId: z.number().int().positive(),
        commissionPercentage: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        creditLine: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        if (!input.commissionPercentage && !input.creditLine) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one field (commissionRate or creditLine) must be provided",
          });
        }

        const relationshipData = await db
          .select()
          .from(providerDistributorRelationships)
          .where(eq(providerDistributorRelationships.id, input.relationshipId));

        if (relationshipData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Relationship not found",
          });
        }

        const relationship = relationshipData[0];

        if (relationship.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to update this relationship",
          });
        }

        if (input.commissionPercentage) {
          const commissionValue = parseFloat(input.commissionPercentage);
          if (commissionValue < 0 || commissionValue > 100) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Commission rate must be between 0 and 100",
            });
          }
        }

        if (input.creditLine) {
          const creditValue = parseFloat(input.creditLine);
          if (creditValue < 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Credit line must be a positive number",
            });
          }
        }

        const updateData: any = {
          updatedAt: new Date(),
        };
        if (input.commissionPercentage) updateData.commissionPercentage = input.commissionPercentage;
        if (input.creditLine) updateData.creditLine = input.creditLine;

        await db
          .update(providerDistributorRelationships)
          .set(updateData)
          .where(eq(providerDistributorRelationships.id, input.relationshipId));

        return {
          success: true,
          message: "Relationship terms updated successfully",
          relationshipId: input.relationshipId,
        };
      } catch (error) {
        console.error("[Provider Router] Error updating relationship terms:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update relationship terms",
        });
      }
    }),

  /**
   * provider.suspendDistributor
   * Suspends a distributor relationship.
   */
  suspendDistributor: protectedProcedure
    .input(
      z.object({
        relationshipId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const relationshipData = await db
          .select()
          .from(providerDistributorRelationships)
          .where(eq(providerDistributorRelationships.id, input.relationshipId));

        if (relationshipData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Relationship not found",
          });
        }

        const relationship = relationshipData[0];

        if (relationship.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to suspend this relationship",
          });
        }

        if (relationship.status !== "active") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot suspend a ${relationship.status} relationship`,
          });
        }

        await db
          .update(providerDistributorRelationships)
          .set({
            status: "suspended",
            updatedAt: new Date(),
          })
          .where(eq(providerDistributorRelationships.id, input.relationshipId));

        return {
          success: true,
          message: `Distributor suspended successfully. Reason: ${input.reason}`,
          relationshipId: input.relationshipId,
        };
      } catch (error) {
        console.error("[Provider Router] Error suspending distributor:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to suspend distributor",
        });
      }
    }),

  /**
   * provider.reactivateDistributor
   * Reactivates a suspended distributor relationship.
   */
  reactivateDistributor: protectedProcedure
    .input(
      z.object({
        relationshipId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const relationshipData = await db
          .select()
          .from(providerDistributorRelationships)
          .where(eq(providerDistributorRelationships.id, input.relationshipId));

        if (relationshipData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Relationship not found",
          });
        }

        const relationship = relationshipData[0];

        if (relationship.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to reactivate this relationship",
          });
        }

        if (relationship.status !== "suspended") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot reactivate a ${relationship.status} relationship`,
          });
        }

        await db
          .update(providerDistributorRelationships)
          .set({
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(providerDistributorRelationships.id, input.relationshipId));

        return {
          success: true,
          message: "Distributor reactivated successfully",
          relationshipId: input.relationshipId,
        };
      } catch (error) {
        console.error("[Provider Router] Error reactivating distributor:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reactivate distributor",
        });
      }
    }),

  /**
   * provider.approveRequest
   * Approves a distributor access request and creates a relationship.
   */
  approveRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const requestData = await db
          .select()
          .from(accessRequests)
          .where(eq(accessRequests.id, input.requestId));

        if (requestData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        const request = requestData[0];

        if (request.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to approve this request",
          });
        }

        if (request.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot approve a ${request.status} request`,
          });
        }

        // Create provider-distributor relationship
        await db.insert(providerDistributorRelationships).values({
          providerId,
          distributorId: request.distributorId,
          commissionPercentage: request.requestedCommission.toString(),
          commissionType: "percentage",
          creditLine: request.requestedCreditLine.toString(),
          status: "active",
        });

        // Create commission config entry — purchase service reads from this table.
        // requestedCommission is stored as a whole-number percentage (e.g. 5.00 = 5%);
        // providerDistributorCommission.commissionRate uses decimal format (e.g. 0.0500).
        const commissionRate = (parseFloat(request.requestedCommission.toString()) / 100).toFixed(4);
        await db.insert(providerDistributorCommission).values({
          providerId,
          distributorId: request.distributorId,
          commissionRate,
          commissionType: "percentage",
        });

        // Create financial account — queue manager requires this row to process purchases.
        // Balance starts at 0; credit line is taken from the approved request.
        await db.insert(providerDistributorAccounts).values({
          providerId,
          distributorId: request.distributorId,
          balance: "0.00",
          creditLine: request.requestedCreditLine.toString(),
          usedCredit: "0.00",
          version: 1,
        });

        // Update request status
        await db
          .update(accessRequests)
          .set({
            status: "approved",
            reviewedBy: providerId,
            reviewedAt: new Date(),
          })
          .where(eq(accessRequests.id, input.requestId));

        // Notify distributor of approval
        try {
          await NotificationService.createNotification({
            userId: request.distributorId,
            type: "REQUEST_APPROVED",
            message: `Your connection request has been approved by the provider. Commission: ${request.requestedCommission}%, Credit Line: $${request.requestedCreditLine}`,
            relatedEntityId: input.requestId,
            relatedEntityType: "access_request",
          });
        } catch (notificationError) {
          console.error("[Provider Router] Failed to create approval notification:", notificationError);
        }

        return {
          success: true,
          message: "Request approved and relationship created",
          requestId: input.requestId,
        };
      } catch (error) {
        console.error("[Provider Router] Error approving request:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to approve request",
        });
      }
    }),

  /**
   * provider.rejectRequest
   * Rejects a distributor access request.
   */
  rejectRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number().int().positive(),
        rejectionReason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const requestData = await db
          .select()
          .from(accessRequests)
          .where(eq(accessRequests.id, input.requestId));

        if (requestData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        const request = requestData[0];

        if (request.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to reject this request",
          });
        }

        if (request.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot reject a ${request.status} request`,
          });
        }

        // Update request status
        await db
          .update(accessRequests)
          .set({
            status: "rejected",
            rejectionReason: input.rejectionReason,
            reviewedBy: providerId,
            reviewedAt: new Date(),
          })
          .where(eq(accessRequests.id, input.requestId));

        // Notify distributor of rejection
        try {
          await NotificationService.createNotification({
            userId: request.distributorId,
            type: "REQUEST_REJECTED",
            message: `Your connection request has been rejected. Reason: ${input.rejectionReason}`,
            relatedEntityId: input.requestId,
            relatedEntityType: "access_request",
          });
        } catch (notificationError) {
          console.error("[Provider Router] Failed to create rejection notification:", notificationError);
        }

        return {
          success: true,
          message: "Request rejected",
          requestId: input.requestId,
        };
      } catch (error) {
        console.error("[Provider Router] Error rejecting request:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reject request",
        });
      }
    }),

  /**
   * provider.getInventory
   * Returns inventory for authenticated provider
   * Includes product info and card counts (available, sold)
   */
  getInventory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");
    const providerId = await getProviderIdFromUser(ctx.user.id);

    try {
      // Get all products for this provider
      const providerProducts = await db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          status: products.status,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(eq(products.providerId, providerId));

      // For each product, get card counts
      const inventory = await Promise.all(
        providerProducts.map(async (product) => {
          const cardCounts = await db
            .select({
              status: cards.status,
              count: count(),
            })
            .from(cards)
            .where(
              and(
                eq(cards.providerId, providerId),
                eq(cards.productId, product.id)
              )
            )
            .groupBy(cards.status);

          const availableCards =
            cardCounts.find((c) => c.status === "AVAILABLE")?.count || 0;
          const soldCards =
            cardCounts.find((c) => c.status === "SOLD")?.count || 0;

          return {
            id: product.id,
            name: product.name,
            description: product.description,
            price: parseFloat(product.price.toString()),
            status: product.status,
            availableCards,
            soldCards,
            totalCards: availableCards + soldCards,
            lowStock: availableCards < 100,
            createdAt: product.createdAt,
          };
        })
      );

      return {
        success: true,
        inventory,
        totalProducts: inventory.length,
        totalAvailable: inventory.reduce((sum, p) => sum + p.availableCards, 0),
        totalSold: inventory.reduce((sum, p) => sum + p.soldCards, 0),
        lowStockItems: inventory.filter((p) => p.lowStock).length,
      };
    } catch (error) {
      console.error("[Provider Router] Error getting inventory:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get inventory",
      });
    }
  }),

  /**
   * provider.uploadCards
   * Upload prepaid cards via CSV file
   * 
   * CSV format: pin[,serial_number]
   * - PIN: required, 4-32 characters
   * - serial_number: optional, max 128 characters
   * Returns: upload summary with success/failure counts
   */

  /**
   * STEP 1: Preview card upload
   * Validates CSV/XLSX file without creating batch
   * Returns preview summary with validation results
   */
  previewCardUpload: protectedProcedure
    .input(previewCardUploadInputSchema)
    .mutation(async ({ ctx, input }) => {
      return handlePreviewCardUpload(ctx, input);
    }),

  /**
   * STEP 2: Confirm card upload
   * Creates batch and inserts valid cards after user approval
   */
  confirmCardUpload: protectedProcedure
    .input(confirmCardUploadInputSchema)
    .mutation(async ({ ctx, input }) => {
      return handleConfirmCardUpload(ctx, input);
    }),

  /**
   * STEP 3: Cancel card upload
   * Cancels preview without creating batch
   */
  cancelCardUpload: protectedProcedure
    .input(cancelCardUploadInputSchema)
    .mutation(async ({ ctx, input }) => {
      return handleCancelCardUpload(ctx, input);
    }),
  uploadCards: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        csvContent: z.string().optional(),
        fileBuffer: z.instanceof(Buffer).optional(),
        fileName: z.string().default("upload.csv"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);
      
      let batchId: number | null = null;

      try {
        // Verify product belongs to this provider
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, providerId)
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or does not belong to this provider",
          });
        }

        // Detect file format and parse
        let parseResult;
        if (input.csvContent) {
          // CSV format
          parseResult = parseCSV(input.csvContent);
        } else if (input.fileBuffer) {
          // XLSX format
          const fileName = input.fileName.toLowerCase();
          if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Unsupported file format. Please upload CSV or XLSX file.",
            });
          }
          parseResult = parseXLSX(input.fileBuffer);
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No file content provided",
          });
        }

        // Check for parse errors
        if (parseResult.errors.length > 0 && parseResult.cards.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: parseResult.errors[0].error,
          });
        }

        if (parseResult.cards.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No valid cards found in file",
          });
        }

        // Note: Master key is now managed by centralized encryption service
        // No need to load it here - it's handled by pinEncryptionService

        // Create batch record using raw query to get insertId
        const rawDb = await getRawDb();
        if (!rawDb) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection not available",
          });
        }

        const [batchInsertResult] = await rawDb.query(
          `INSERT INTO card_batches (provider_id, filename, upload_status, total_cards, uploaded_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [providerId, input.fileName, "processing", parseResult.cards.length, providerId]
        );

        batchId = (batchInsertResult as any).insertId as number;

        // Validate all cards before inserting (fail fast)
        const results = {
          totalRows: parseResult.cards.length,
          insertedRows: 0,
          failedRows: 0,
          errors: [...parseResult.errors] as Array<{ rowNumber: number; pin?: string; error: string }>,
          duplicatePins: [] as string[],
        };

        // Track PINs we've already seen in this upload
        const seenPins = new Set<string>();
        // Track PINs that already exist in database
        const existingPins = new Set<string>();

        // Get existing PIN hashes for this product to detect duplicates
        if (rawDb) {
          const [existingRows] = await rawDb.query(
            `SELECT pin_hash FROM cards WHERE product_id = ? AND provider_id = ? AND pin_hash IS NOT NULL`,
            [input.productId, providerId]
          );
          if (Array.isArray(existingRows)) {
            existingRows.forEach((row: any) => {
              if (row.pin_hash) {
                existingPins.add(row.pin_hash);
              }
            });
          }
        }

        // Validate all cards first
        const validatedCards: Array<{ card: ParsedCard; encryptedPin: string }> = [];
        for (const card of parseResult.cards) {
          // Validate PIN
          if (!validatePin(card.pin)) {
            results.failedRows++;
            results.errors.push({
              rowNumber: card.rowNumber,
              pin: card.pin,
              error: "Invalid PIN format (must be 4-32 characters)",
            });
            continue;
          }

          // Check for duplicates within this upload
          if (seenPins.has(card.pin)) {
            results.failedRows++;
            results.duplicatePins.push(card.pin);
            results.errors.push({
              rowNumber: card.rowNumber,
              pin: card.pin,
              error: "Duplicate PIN in this upload",
            });
            continue;
          }

          seenPins.add(card.pin);

          // Encrypt PIN using centralized service (AES-256-GCM)
          let encryptedPin: string;
          try {
            encryptedPin = await pinEncryptionService.encryptPIN(card.pin);
          } catch (error) {
            results.failedRows++;
            results.errors.push({
              rowNumber: card.rowNumber,
              pin: card.pin,
              error: "Failed to encrypt PIN",
            });
            continue;
          }

          // Check if PIN already exists using pin_hash
          const pinHash = hashPin(card.pin);
          if (existingPins.has(pinHash)) {
            results.failedRows++;
            results.errors.push({
              rowNumber: card.rowNumber,
              pin: card.pin,
              error: "PIN already exists in inventory",
            });
            continue;
          }

          validatedCards.push({ card, encryptedPin });
        }

        // If there are validation errors, reject the entire batch
        if (results.failedRows > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Validation failed: ${results.failedRows} row(s) with errors. ${results.errors.map((e) => `Row ${e.rowNumber}: ${e.error}`).join("; ")}`,
          });
        }

        // Import hashPin at the top of the file
        // Insert all validated cards
        for (const { card, encryptedPin } of validatedCards) {
          try {
            const pinHash = hashPin(card.pin);
            await db.insert(cards).values({
              providerId,
              productId: input.productId,
              batchId,
              pinEncrypted: encryptedPin,
              pinHash: pinHash,
              serialNumber: card.serialNumber,
              status: "AVAILABLE",
            });
            results.insertedRows++;
          } catch (error) {
            results.failedRows++;
            results.errors.push({
              rowNumber: card.rowNumber,
              pin: card.pin,
              error: `Database error: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
          }
        }

        // Update batch status
        if (batchId) {
          await db
            .update(cardBatches)
            .set({
              uploadStatus: "completed",
              processedCards: results.insertedRows,
              failedCards: results.failedRows,
              updatedAt: new Date(),
            })
            .where(eq(cardBatches.id, batchId));
        }

        return {
          success: results.failedRows === 0,
          batchId,
          ...results,
          message: results.failedRows === 0 
            ? `Upload completed: ${results.insertedRows} cards inserted` 
            : `Upload completed with errors: ${results.insertedRows} cards inserted, ${results.failedRows} failed`,
        };
      } catch (error) {
        console.error("[Provider Router] Error uploading cards:", error);
        
        // Update batch status to failed if batchId exists
        if (batchId) {
          try {
            await db
              .update(cardBatches)
              .set({
                uploadStatus: "failed",
                updatedAt: new Date(),
              })
              .where(eq(cardBatches.id, batchId));
          } catch (updateError) {
            console.error("[Provider Router] Failed to update batch status:", updateError);
          }
        }
        
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to upload cards",
        });
      }
    }),

  /**
   * provider.uploadHistory
   * Returns list of upload batches for the authenticated provider
   */
  uploadHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const batches = await db
          .select({
            id: cardBatches.id,
            fileName: cardBatches.filename,
            uploadedAt: cardBatches.createdAt,
            status: cardBatches.uploadStatus,
            totalCards: cardBatches.totalCards,
            successRecords: cardBatches.processedCards,
            failedRecords: cardBatches.failedCards,
          })
          .from(cardBatches)
          .where(eq(cardBatches.providerId, providerId))
          .orderBy(desc(cardBatches.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        return {
          uploads: batches.map((batch) => ({
            id: batch.id.toString(),
            fileName: batch.fileName,
            uploadedAt: batch.uploadedAt,
            status: batch.status,
            totalCards: batch.totalCards,
            successRecords: batch.successRecords,
            failedRecords: batch.failedRecords,
          })),
          total: batches.length,
        };
      } catch (error) {
        console.error("[Provider Router] Error fetching upload history:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch upload history",
        });
      }
    }),

  /**
   * provider.getUploadErrors
   * Returns detailed error records for a specific upload batch
   */
  getUploadErrors: protectedProcedure
    .input(
      z.object({
        batchId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const batch = await db
          .select()
          .from(cardBatches)
          .where(eq(cardBatches.id, input.batchId))
          .limit(1);

        if (batch.length === 0 || batch[0].providerId !== providerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Upload batch not found",
          });
        }

        return {
          batchId: input.batchId,
          fileName: batch[0].filename,
          errors: [] as Array<{ rowNumber: number; pin: string; error: string }>,
          total: 0,
        };
      } catch (error) {
        console.error("[Provider Router] Error fetching upload errors:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch upload errors",
        });
      }
    }),

  /**
   * provider.createProduct
   * Creates a new product for the authenticated provider
   */
  createProduct: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        displayName: z.string().max(255).optional(),
        description: z.string().optional(),
        faceValue: z.number().positive().optional(),
        currency: z.string().length(3).default("USD"),
        price: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const result = await db.insert(products).values({
          providerId,
          name: input.name,
          displayName: input.displayName || input.name,
          description: input.description,
          faceValue: input.faceValue ? parseFloat(input.faceValue.toString()) : null,
          currency: input.currency,
          price: parseFloat(input.price.toString()),
          status: "active",
          isActive: 1,
        } as any);

        // Drizzle MySQL may return the OkPacket either as result[0] or directly as result
        const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
        const newProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, insertId))
          .limit(1);

        if (newProduct.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve created product",
          });
        }

        return {
          success: true,
          product: newProduct[0],
        };
      } catch (error) {
        console.error("[Provider Router] Error creating product:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create product",
        });
      }
    }),

  /**
   * provider.updateProduct
   * Updates an existing product
   */
  updateProduct: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        displayName: z.string().max(255).optional(),
        description: z.string().optional(),
        faceValue: z.number().positive().optional(),
        currency: z.string().length(3).optional(),
        price: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, providerId)
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or does not belong to this provider",
          });
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.name !== undefined) updateData.name = input.name;
        if (input.displayName !== undefined) updateData.displayName = input.displayName;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.faceValue !== undefined) updateData.faceValue = input.faceValue;
        if (input.currency !== undefined) updateData.currency = input.currency;
        if (input.price !== undefined) updateData.price = input.price;

        await db
          .update(products)
          .set(updateData)
          .where(eq(products.id, input.productId));

        const updatedProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        return {
          success: true,
          product: updatedProduct[0],
        };
      } catch (error) {
        console.error("[Provider Router] Error updating product:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update product",
        });
      }
    }),

  /**
   * provider.listProducts
   * Lists all products for the authenticated provider
   */
  listProducts: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
        status: z.enum(["active", "inactive"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const whereConditions = [eq(products.providerId, providerId)];
        if (input.status) {
          whereConditions.push(eq(products.status, input.status));
        }

        const result = await db
          .select()
          .from(products)
          .where(and(...whereConditions))
          .orderBy(desc(products.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        return {
          products: result,
          total: result.length,
        };
      } catch (error) {
        console.error("[Provider Router] Error listing products:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list products",
        });
      }
    }),

  /**
   * provider.setProductStatus
   * Activates or deactivates a product
   */
  setProductStatus: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, providerId)
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or does not belong to this provider",
          });
        }

        await db
          .update(products)
          .set({
            status: input.isActive ? "active" : "inactive",
            isActive: input.isActive ? 1 : 0,
            updatedAt: new Date(),
          })
          .where(eq(products.id, input.productId));

        const updatedProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        return {
          success: true,
          product: updatedProduct[0],
        };
      } catch (error) {
        console.error("[Provider Router] Error setting product status:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to set product status",
        });
      }
    }),
  /**
   * provider.deleteProduct
   * Permanently deletes a product owned by the authenticated provider
   */
  deleteProduct: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, providerId)
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or does not belong to this provider",
          });
        }

        // Block deletion if the product has any cards (active or sold)
        const linkedCards = await db
          .select({ id: cards.id })
          .from(cards)
          .where(eq(cards.productId, input.productId))
          .limit(1);

        if (linkedCards.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Cannot delete this product because it has associated cards (active or purchased). Deactivate the product instead.",
          });
        }

        await db.delete(products).where(eq(products.id, input.productId));

        return { success: true };
      } catch (error) {
        console.error("[Provider Router] Error deleting product:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete product",
        });
      }
    }),

  importProducts: protectedProcedure
    .input(
      z.object({
        csvContent: z.string().min(1, "CSV content is required"),
      })
    )
    .mutation(async ({ ctx, input }: any) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      const result = {
        totalRows: 0,
        successCount: 0,
        failedCount: 0,
        errors: [] as any[],
      };

      const lines = input.csvContent.trim().split("\n");
      if (lines.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV must contain header and at least one data row",
        });
      }

      // Parse header
      const headerLine = lines[0];
      const headers = headerLine.split(",").map((h: string) => h.trim().toLowerCase());

      // Validate required headers
      const requiredHeaders = ["name", "displayname", "facevalue", "currency"];
      const hasRequiredHeaders = requiredHeaders.every((h: string) => headers.includes(h));
      if (!hasRequiredHeaders) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `CSV must contain headers: ${requiredHeaders.join(", ")}`,
        });
      }

      // Get existing product names
      const existingProducts = await db
        .select({ name: products.name })
        .from(products)
        .where(eq(products.providerId, providerId));
      const existingNames = new Set(existingProducts.map((p: any) => p.name.toLowerCase()));

      // Process rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        result.totalRows++;
        const rowNumber = i + 1;

        try {
          // Parse CSV row
          const values = line.split(",").map((v: string) => v.trim());
          const rowData: Record<string, any> = {};
          headers.forEach((header: string, index: number) => {
            rowData[header] = values[index] || "";
          });

          // Validate required fields
          const name = rowData["name"];
          const displayName = rowData["displayname"];
          const faceValue = parseFloat(rowData["facevalue"]);
          const currency = rowData["currency"];
          const description = rowData["description"] || "";
          const isActive = rowData["isactive"] !== "false" && rowData["isactive"] !== "0";

          if (!name) throw new Error("Product name is required");
          if (!displayName) throw new Error("Display name is required");
          if (isNaN(faceValue) || faceValue <= 0) throw new Error("Face value must be a positive number");
          if (!currency || currency.length !== 3) throw new Error("Currency must be a 3-letter code");

          // Check for duplicates
          if (existingNames.has(name.toLowerCase())) {
            throw new Error(`Product name "${name}" already exists`);
          }

          // Create product
          await db.insert(products).values({
            providerId,
            name,
            displayName,
            faceValue,
            currency,
            description,
            status: isActive ? "active" : "inactive",
            price: faceValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          existingNames.add(name.toLowerCase());
          result.successCount++;
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            rowNumber,
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return result;
    }),

  /**
   * provider.getSettings
   * Get provider organization settings
   */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const pool = await getRawDb();
    if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    try {
      const conn = await pool.getConnection();
      try {
        // Get provider organization info
        const [rows] = await conn.execute(
          `SELECT o.id, o.name, o.type, o.status, o.contact_person, o.email, o.phone, o.address, o.notes, o.logo_url,
                  sp.id as provider_id, sp.provider_code, sp.created_at, sp.updated_at, u.name as user_name, u.email as user_email
           FROM organizations o
           INNER JOIN organization_users ou ON o.id = ou.organization_id
           INNER JOIN service_providers sp ON sp.organization_id = o.id
           LEFT JOIN users u ON u.id = ou.user_id
           WHERE ou.user_id = ? AND o.type = 'provider'
           LIMIT 1`,
          [ctx.user.id]
        );
        
        if (!rows || rows.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Provider settings not found",
          });
        }
        
        const row = rows[0];
        return {
          organizationId: row.id,
          providerId: row.provider_id,
          providerCode: row.provider_code,
          organizationName: row.name || "",
          organizationStatus: row.status || "active",
          contactPerson: row.contact_person || "",
          email: row.email || "",
          phone: row.phone || "",
          address: row.address || "",
          notes: row.notes || "",
          logoUrl: row.logo_url || null,
          userName: row.user_name || "",
          userEmail: row.user_email || "",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("[Provider Router] Error getting settings:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get settings",
      });
    }
  }),

  /**
   * provider.updateSettings
   * Update provider organization settings
   */
  updateSettings: protectedProcedure
    .input(
      z.object({
        organizationName: z.string().min(1, "Organization name is required"),
        contactPerson: z.string().optional(),
        email: z.string().email("Invalid email address").optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      try {
        const conn = await pool.getConnection();
        try {
          // Get organization ID from user
          const [orgRows] = await conn.execute(
            `SELECT o.id FROM organizations o
             INNER JOIN organization_users ou ON o.id = ou.organization_id
             WHERE ou.user_id = ? AND o.type = 'provider'
             LIMIT 1`,
            [ctx.user.id]
          );
          
          if (!orgRows || orgRows.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Provider organization not found",
            });
          }
          
          const organizationId = orgRows[0].id;
          
          // Update organization
          await conn.execute(
            `UPDATE organizations SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, notes = ? WHERE id = ?`,
            [
              input.organizationName,
              input.contactPerson || null,
              input.email || null,
              input.phone || null,
              input.address || null,
              input.notes || null,
              organizationId,
            ]
          );
          
          return { success: true, message: "Settings updated successfully" };
        } finally {
          conn.release();
        }
      } catch (error) {
        console.error("[Provider Router] Error updating settings:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update settings",
        });
      }
    }),

  uploadLogo: protectedProcedure
    .input(z.object({
      logoDataUrl: z.string().max(2_000_000, "Image too large (max ~1.5 MB)"),
    }))
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const conn = await pool.getConnection();
      try {
        await conn.execute(
          `UPDATE organizations o
           INNER JOIN organization_users ou ON o.id = ou.organization_id
           SET o.logo_url = ?
           WHERE ou.user_id = ? AND o.type = 'provider'`,
          [input.logoDataUrl, ctx.user.id]
        );
        return { success: true };
      } finally {
        conn.release();
      }
    }),

  /**
   * provider.downloadExcelTemplate
   * Download Excel template for card upload
   * Returns binary Excel file buffer
   */
  downloadExcelTemplate: publicProcedure.query(async () => {
    try {
      const { generateExcelTemplate } = await import("../utils/file-parser");
      const buffer = generateExcelTemplate();
      return {
        success: true,
        buffer: buffer.toString("base64"),
        fileName: "card-upload-template.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    } catch (error) {
      console.error("[Provider Router] Error generating template:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate Excel template",
      });
    }
  }),

  /**
   * provider.topUpDistributorBalance
   * Credits a distributor's account balance after the provider receives payment.
   *
   * Requires:
   * - Authenticated provider
   * - Active relationship between this provider and the distributor
   * - Positive amount
   *
   * Returns updated balance.
   */
  topUpDistributorBalance: protectedProcedure
    .input(
      z.object({
        distributorId: z.number().int().positive(),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid positive number"),
        paymentReference: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id);

      try {
        // Verify the distributor is actively connected to this provider
        const relationship = await db
          .select({ id: providerDistributorRelationships.id, status: providerDistributorRelationships.status })
          .from(providerDistributorRelationships)
          .where(
            and(
              eq(providerDistributorRelationships.providerId, providerId),
              eq(providerDistributorRelationships.distributorId, input.distributorId)
            )
          )
          .limit(1);

        if (relationship.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No relationship found with this distributor",
          });
        }

        if (relationship[0].status !== "active") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot top up a ${relationship[0].status} account`,
          });
        }

        // Use a payment reference if provided, otherwise generate one
        const paymentId = input.paymentReference?.trim()
          ? input.paymentReference.trim()
          : `TOPUP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        const result = await topUpService.processTopUp({
          providerId,
          distributorId: input.distributorId,
          amount: input.amount,
          paymentId,
          description: input.paymentReference ? `Payment ref: ${input.paymentReference}` : undefined,
        });

        return {
          success: true,
          newBalance: result.newBalance.toNumber(),
          paymentId,
          message: result.message,
        };
      } catch (error) {
        console.error("[Provider Router] Error processing top-up:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to process top-up",
        });
      }
    }),

  /**
   * provider.generatePins
   * Generate a batch of random PIN codes and store them directly — no CSV needed.
   *
   * Serial number modes:
   *  - "auto"   : system generates SN-{batchId}-{0001..N}
   *  - "custom" : user supplies startSerial + interval → startSerial, startSerial+interval, …
   */
  generatePins: protectedProcedure
    .input(
      z.object({
        productId:    z.number().int().positive(),
        count:        z.number().int().min(1).max(10000),
        pinLength:    z.number().int().min(4).max(32),
        prefix:       z.string().max(8).optional(),
        serialMode:   z.enum(["auto", "custom"]),
        startSerial:  z.number().int().min(0).optional(),
        serialInterval: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const providerId = await getProviderIdFromUser(ctx.user.id);
      const rawDb = await getRawDb();
      if (!rawDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify product exists and belongs to this provider
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const product = await db.select().from(products).where(
        and(eq(products.id, input.productId), eq(products.providerId, providerId))
      ).limit(1);

      if (product.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      // Load existing PIN hashes and serial numbers for uniqueness checks
      // Also find the max numeric serial for auto-increment mode
      const conn = await rawDb.getConnection();
      let existingPinHashes: Set<string> = new Set();
      let existingSerials:   Set<string> = new Set();
      let maxNumericSerial  = 0;
      try {
        const [pinRows] = await conn.execute(
          `SELECT pin_hash FROM cards WHERE provider_id = ? AND pin_hash IS NOT NULL`,
          [providerId]
        ) as any[];
        (pinRows as any[]).forEach((r: any) => r.pin_hash && existingPinHashes.add(r.pin_hash));

        const [snRows] = await conn.execute(
          `SELECT serial_number FROM cards WHERE provider_id = ? AND serial_number IS NOT NULL`,
          [providerId]
        ) as any[];
        (snRows as any[]).forEach((r: any) => {
          if (!r.serial_number) return;
          existingSerials.add(r.serial_number);
          // Track the largest purely-numeric serial for auto-increment
          const asNum = parseInt(r.serial_number, 10);
          if (!isNaN(asNum) && asNum > maxNumericSerial) maxNumericSerial = asNum;
        });
      } finally {
        conn.release();
      }

      // Create the batch record first so we have its ID for auto serial numbers
      const batchConn = await rawDb.getConnection();
      let batchId: number;
      try {
        const [result] = await batchConn.execute(
          `INSERT INTO card_batches (provider_id, filename, upload_status, total_cards, processed_cards, failed_cards, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [providerId, `generated-batch-${Date.now()}`, "processing", input.count, 0, 0, ctx.user.id]
        ) as any[];
        batchId = result.insertId;
      } finally {
        batchConn.release();
      }

      // Generate PINs and serial numbers
      const prefix      = input.prefix ?? "";
      const pinLength   = input.pinLength;
      const startSerial = input.startSerial ?? 1;
      const interval    = input.serialInterval ?? 1;

      const generatedCards: Array<{ pin: string; serial: string }> = [];
      const seenPins:    Set<string> = new Set();
      const seenSerials: Set<string> = new Set();
      let attempts = 0;
      const MAX_ATTEMPTS = input.count * 10;

      while (generatedCards.length < input.count && attempts < MAX_ATTEMPTS) {
        attempts++;

        // Generate random numeric PIN
        let pin = prefix;
        const digitsNeeded = pinLength - prefix.length;
        if (digitsNeeded <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Prefix is too long for the selected PIN length" });
        }
        for (let d = 0; d < digitsNeeded; d++) {
          pin += Math.floor(Math.random() * 10).toString();
        }

        // Skip if duplicate PIN
        const pinHash = hashPin(pin);
        if (seenPins.has(pin) || existingPinHashes.has(pinHash)) continue;

        // Determine serial number
        const idx = generatedCards.length;
        const serial = input.serialMode === "auto"
          ? String(maxNumericSerial + idx + 1)   // continues from the largest existing serial
          : String(startSerial + idx * interval);

        // Skip if duplicate serial
        if (seenSerials.has(serial) || existingSerials.has(serial)) {
          if (input.serialMode === "custom") {
            // Custom serials are deterministic — if one collides the whole batch would, fail early
            throw new TRPCError({
              code: "CONFLICT",
              message: `Serial number ${serial} already exists. Choose a different start point or interval.`,
            });
          }
          continue;
        }

        seenPins.add(pin);
        seenSerials.add(serial);
        generatedCards.push({ pin, serial });
      }

      if (generatedCards.length < input.count) {
        // Clean up the batch record we created
        const cleanConn = await rawDb.getConnection();
        try { await cleanConn.execute(`DELETE FROM card_batches WHERE id = ?`, [batchId]); }
        finally { cleanConn.release(); }

        throw new TRPCError({
          code: "CONFLICT",
          message: `Could only generate ${generatedCards.length} unique PINs out of ${input.count} requested. Try a longer PIN length or smaller count.`,
        });
      }

      // Encrypt and insert cards
      let insertedCount = 0;
      for (const { pin, serial } of generatedCards) {
        const encryptedPin = await pinEncryptionService.encryptPIN(pin);
        const pinHash      = hashPin(pin);
        const insertConn   = await rawDb.getConnection();
        try {
          await insertConn.execute(
            `INSERT INTO cards (provider_id, product_id, batch_id, pin_encrypted, pin_hash, serial_number, status)
             VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
            [providerId, input.productId, batchId, encryptedPin, pinHash, serial]
          );
          insertedCount++;
        } finally {
          insertConn.release();
        }
      }

      // Mark batch complete
      await db.update(cardBatches).set({
        processedCards: insertedCount,
        uploadStatus: "completed",
      }).where(eq(cardBatches.id, batchId));

      return {
        success: true,
        batchId,
        insertedCount,
        productName: product[0].name,
        serialMode: input.serialMode,
        firstSerial: generatedCards[0]?.serial,
        lastSerial:  generatedCards[generatedCards.length - 1]?.serial,
      };
    }),

  /**
   * provider.validateInventory
   * Scans the provider's card inventory for:
   *  1. Duplicate PIN hashes (same PIN stored more than once)
   *  2. Duplicate serial numbers (same serial on multiple cards)
   * Returns counts, examples, and per-product breakdown.
   */
  validateInventory: protectedProcedure.query(async ({ ctx }) => {
    const providerId = await getProviderIdFromUser(ctx.user.id);
    const rawDb = await getRawDb();
    if (!rawDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const conn = await rawDb.getConnection();
    try {
      // Total cards
      const [totalRows] = await conn.execute(
        `SELECT COUNT(*) as total FROM cards WHERE provider_id = ?`,
        [providerId]
      ) as any[];
      const totalCards = totalRows[0]?.total ?? 0;

      // Duplicate PIN hashes
      const [dupPinRows] = await conn.execute(
        `SELECT pin_hash, COUNT(*) as cnt
         FROM cards
         WHERE provider_id = ? AND pin_hash IS NOT NULL
         GROUP BY pin_hash
         HAVING cnt > 1
         ORDER BY cnt DESC
         LIMIT 20`,
        [providerId]
      ) as any[];

      // Get card IDs for duplicate PINs (for display)
      const dupPinExamples: Array<{ pinHash: string; count: number; cardIds: number[] }> = [];
      for (const row of (dupPinRows as any[])) {
        const [idRows] = await conn.execute(
          `SELECT id FROM cards WHERE provider_id = ? AND pin_hash = ? LIMIT 5`,
          [providerId, row.pin_hash]
        ) as any[];
        dupPinExamples.push({
          pinHash: row.pin_hash.substring(0, 12) + '…',
          count:   row.cnt,
          cardIds: (idRows as any[]).map((r: any) => r.id),
        });
      }

      // Duplicate serial numbers
      const [dupSnRows] = await conn.execute(
        `SELECT serial_number, COUNT(*) as cnt
         FROM cards
         WHERE provider_id = ? AND serial_number IS NOT NULL
         GROUP BY serial_number
         HAVING cnt > 1
         ORDER BY cnt DESC
         LIMIT 20`,
        [providerId]
      ) as any[];

      const dupSnExamples: Array<{ serial: string; count: number; cardIds: number[] }> = [];
      for (const row of (dupSnRows as any[])) {
        const [idRows] = await conn.execute(
          `SELECT id FROM cards WHERE provider_id = ? AND serial_number = ? LIMIT 5`,
          [providerId, row.serial_number]
        ) as any[];
        dupSnExamples.push({
          serial:  row.serial_number,
          count:   row.cnt,
          cardIds: (idRows as any[]).map((r: any) => r.id),
        });
      }

      // Cards with no serial number
      const [noSnRows] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM cards WHERE provider_id = ? AND (serial_number IS NULL OR serial_number = '')`,
        [providerId]
      ) as any[];
      const cardsWithoutSerial = noSnRows[0]?.cnt ?? 0;

      // Per-product breakdown
      const [productRows] = await conn.execute(
        `SELECT p.name as productName, p.id as productId,
                COUNT(c.id) as totalCards,
                SUM(CASE WHEN c.status = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN c.status = 'SOLD' THEN 1 ELSE 0 END) as sold
         FROM cards c
         JOIN products p ON c.product_id = p.id
         WHERE c.provider_id = ?
         GROUP BY p.id, p.name
         ORDER BY totalCards DESC`,
        [providerId]
      ) as any[];

      return {
        totalCards,
        duplicatePins:    (dupPinRows as any[]).length,
        duplicateSerials: (dupSnRows as any[]).length,
        cardsWithoutSerial,
        dupPinExamples,
        dupSnExamples,
        productBreakdown: (productRows as any[]).map((r: any) => ({
          productId:   r.productId,
          productName: r.productName,
          totalCards:  r.totalCards,
          available:   r.available,
          sold:        r.sold,
        })),
        isClean: (dupPinRows as any[]).length === 0 && (dupSnRows as any[]).length === 0,
      };
    } finally {
      conn.release();
    }
  }),
});
