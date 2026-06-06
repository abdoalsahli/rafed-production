import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import {
  accessRequests,
  providerDistributorRelationships,
  distributors,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Provider Request Mutations
 * 
 * Handles approval and rejection of distributor access requests
 */
export const providerRequestMutations = {
  /**
   * provider.approveRequest
   * 
   * Approves a pending access request and creates a provider-distributor relationship.
   * 
   * On approval:
   * 1. Update access request status to 'approved'
   * 2. Create provider_distributor_relationship with agreed commission and credit line
   * 3. Set relationship status to 'active'
   * 
   * Authorization: Only the provider who received the request can approve it
   */
  approveRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const providerId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        // Step 1: Fetch the access request
        const requestData = await db
          .select({
            id: accessRequests.id,
            providerId: accessRequests.providerId,
            distributorId: accessRequests.distributorId,
            requestedCommission: accessRequests.requestedCommission,
            requestedCreditLine: accessRequests.requestedCreditLine,
            status: accessRequests.status,
          })
          .from(accessRequests)
          .where(eq(accessRequests.id, input.requestId));

        if (requestData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Access request not found",
          });
        }

        const request = requestData[0];

        // Step 2: Verify authorization - only provider who received the request can approve
        if (request.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to approve this request",
          });
        }

        // Step 3: Verify request is still pending
        if (request.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Request is already ${request.status}`,
          });
        }

        // Step 4: Update access request status to approved
        await db
          .update(accessRequests)
          .set({
            status: "approved",
            reviewedAt: new Date(),
            reviewedBy: ctx.user.id,
          })
          .where(eq(accessRequests.id, input.requestId));

        // Step 5: Create provider-distributor relationship
        await db.insert(providerDistributorRelationships).values({
          providerId: request.providerId,
          distributorId: request.distributorId,
          commissionPercentage: request.requestedCommission.toString(),
          commissionType: "percentage",
          creditLine: request.requestedCreditLine.toString(),
          status: "active",
        });

        return {
          success: true,
          message: "Access request approved successfully",
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
   * 
   * Rejects a pending access request.
   * 
   * On rejection:
   * 1. Update access request status to 'rejected'
   * 2. Store rejection reason
   * 3. Record rejecting user
   * 
   * Authorization: Only the provider who received the request can reject it
   */
  rejectRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number().int().positive(),
        rejectionReason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const providerId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        // Step 1: Fetch the access request
        const requestData = await db
          .select({
            id: accessRequests.id,
            providerId: accessRequests.providerId,
            status: accessRequests.status,
          })
          .from(accessRequests)
          .where(eq(accessRequests.id, input.requestId));

        if (requestData.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Access request not found",
          });
        }

        const request = requestData[0];

        // Step 2: Verify authorization - only provider who received the request can reject
        if (request.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to reject this request",
          });
        }

        // Step 3: Verify request is still pending
        if (request.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Request is already ${request.status}`,
          });
        }

        // Step 4: Update access request status to rejected
        await db
          .update(accessRequests)
          .set({
            status: "rejected",
            rejectionReason: input.rejectionReason,
            reviewedBy: ctx.user.id,
            reviewedAt: new Date(),
          })
          .where(eq(accessRequests.id, input.requestId));

        return {
          success: true,
          message: "Access request rejected successfully",
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
};
