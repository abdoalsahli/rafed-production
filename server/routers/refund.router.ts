import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { RefundService } from "../services/refund.service";

const refundService = new RefundService();

/**
 * Refund Router - Handles refund processing for completed purchases
 * 
 * Endpoints:
 * - refund.process: Process a refund for a completed purchase
 * - refund.status: Check refund status
 * - refund.history: Get refund history for a transaction
 */

export const refundRouter = router({
  /**
   * Process a refund for a completed purchase
   * 
   * Reverses:
   * 1. purchase_debit ledger entry
   * 2. commission_credit ledger entry
   * 3. Restores balance and used_credit correctly
   * 4. Records refund ledger entry
   * 
   * Requires:
   * - Original transaction ID (idempotency)
   * - Purchase amount (verification)
   * - Commission amount (verification)
   * - Refund reason (audit trail)
   */
  process: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().positive("Transaction ID must be positive"),
        purchaseAmount: z.string().regex(/^\d+\.\d{2}$/, "Amount must be in format XX.XX"),
        commissionAmount: z.string().regex(/^\d+\.\d{2}$/, "Amount must be in format XX.XX"),
        refundReason: z.string().min(1, "Refund reason is required").max(255),
        idempotencyKey: z.string().min(1, "Idempotency key is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Ensure user is authenticated
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User must be authenticated",
          });
        }

        const response = await refundService.processRefund({
          distributorId: ctx.user.id,
          transactionId: input.transactionId,
          purchaseAmount: input.purchaseAmount,
          commissionAmount: input.commissionAmount,
          refundReason: input.refundReason,
          idempotencyKey: input.idempotencyKey,
        });

        return {
          success: true,
          transactionId: response.transactionId,
          refundId: response.refundId,
          finalBalance: response.finalBalance,
          finalUsedCredit: response.finalUsedCredit,
          totalRefunded: response.totalRefunded,
          timestamp: response.timestamp,
        };
      } catch (error) {
        console.error("[Refund Router] Error processing refund:", error);
        
        if (error instanceof TRPCError) {
          throw error;
        }

        // Map common error messages to TRPC error codes
        const errorMessage = error instanceof Error ? error.message : "Refund processing failed";
        
        if (errorMessage.includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: errorMessage,
          });
        }

        if (errorMessage.includes("already refunded")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: errorMessage,
          });
        }

        if (errorMessage.includes("Insufficient")) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: errorMessage,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: errorMessage,
        });
      }
    }),

  /**
   * Check refund status for a transaction
   */
  status: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().positive("Transaction ID must be positive"),
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

        const status = await refundService.getRefundStatus({
          distributorId: ctx.user.id,
          transactionId: input.transactionId,
        });

        return status;
      } catch (error) {
        console.error("[Refund Router] Error getting refund status:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get refund status",
        });
      }
    }),

  /**
   * Get refund history for a transaction
   */
  history: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().positive("Transaction ID must be positive"),
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

        const history = await refundService.getRefundHistory({
          distributorId: ctx.user.id,
          transactionId: input.transactionId,
        });

        return history;
      } catch (error) {
        console.error("[Refund Router] Error getting refund history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get refund history",
        });
      }
    }),
});
