import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { PurchaseIntegratedService } from "../services/purchase.integrated.service";
import { TRPCError } from "@trpc/server";
import { isStructuredError, PurchaseErrorCode } from "../services/errors";
import { enforceValidPurchase } from "../services/purchase-validation.service";
import { getDistributorIdFromUser } from "../utils/org-lookup";

const purchaseIntegratedService = new PurchaseIntegratedService();

/**
 * Purchase Router - Using FinancialService for Provider-Distributor Accounts
 * 
 * Endpoints:
 * - purchase.card: Purchase a prepaid card
 */

export const purchaseRouter = router({
  /**
   * Purchase a prepaid card
   * 
   * Uses FinancialService.processPurchase() to:
   * 1. Deduct from provider-distributor account
   * 2. Create purchase_debit ledger entry
   * 3. Create commission_credit ledger entry
   * 4. Allocate card and record transaction
   * 5. Return PIN to distributor
   */
  card: protectedProcedure
    .input(
      z.object({
        productId: z.number().positive("Product ID must be positive"),
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

        // Resolve user → distributor via org membership
        const distributorId = await getDistributorIdFromUser(ctx.user.id);

        // VALIDATION: Enforce product availability and relationship before purchase
        await enforceValidPurchase({
          distributorId,
          productId: input.productId,
        });

        const response = await purchaseIntegratedService.purchaseCard({
          distributorId,
          productId: input.productId,
          idempotencyKey: input.idempotencyKey,
        });

        return {
          success: true,
          transactionId: response.transactionId,
          status: response.status,
          pin: response.pin,
          serialNumber: response.serialNumber,
          amount: response.amount,
          commission: response.commission,
          timestamp: response.timestamp,
        };
      } catch (error) {
        // Handle structured errors from FinancialService
        if (isStructuredError(error)) {
          const errorCode = error.code as PurchaseErrorCode;
          
          // Map purchase error codes to TRPC error codes
          const errorMap: Partial<Record<PurchaseErrorCode, string>> = {
            [PurchaseErrorCode.INVALID_DISTRIBUTOR]: "BAD_REQUEST",
            [PurchaseErrorCode.INVALID_PRODUCT]: "BAD_REQUEST",
            [PurchaseErrorCode.PRODUCT_NOT_FOUND]: "NOT_FOUND",
            [PurchaseErrorCode.INSUFFICIENT_BALANCE]: "PRECONDITION_FAILED",
            [PurchaseErrorCode.NO_INVENTORY]: "RESOURCE_EXHAUSTED",
            [PurchaseErrorCode.TRANSACTION_FAILED]: "INTERNAL_SERVER_ERROR",
            [PurchaseErrorCode.TRANSACTION_TIMEOUT]: "TIMEOUT",
            [PurchaseErrorCode.PIN_DECRYPTION_FAILED]: "INTERNAL_SERVER_ERROR",
            [PurchaseErrorCode.CARD_NOT_FOUND]: "INTERNAL_SERVER_ERROR",
            [PurchaseErrorCode.DUPLICATE_REQUEST]: "BAD_REQUEST",
            [PurchaseErrorCode.WALLET_NOT_FOUND]: "NOT_FOUND",
            [PurchaseErrorCode.CONCURRENT_MODIFICATION]: "CONFLICT",
            [PurchaseErrorCode.PIN_ALREADY_VIEWED]: "PRECONDITION_FAILED",
            [PurchaseErrorCode.DATABASE_ERROR]: "INTERNAL_SERVER_ERROR",
            [PurchaseErrorCode.INTERNAL_ERROR]: "INTERNAL_SERVER_ERROR",
          };

          const trpcCode = errorMap[errorCode] || "INTERNAL_SERVER_ERROR";

          throw new TRPCError({
            code: trpcCode as any,
            message: error.message,
          });
        }

        // Handle unexpected errors
        console.error("[Purchase Router] Unexpected error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Purchase failed",
        });
      }
    }),
});
