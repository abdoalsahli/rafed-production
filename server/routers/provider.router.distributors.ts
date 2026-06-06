import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { providerDistributorRelationships } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Provider Distributor Management Mutations
 * 
 * Handles updating relationship terms and managing relationship status
 */
export const providerDistributorMutations = {
  /**
   * provider.updateRelationshipTerms
   * 
   * Updates commission rate and/or credit line for a distributor relationship.
   * 
   * Authorization: Only the provider who owns the relationship can update it
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
      const providerId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        // Validate at least one field is being updated
        if (!input.commissionPercentage && !input.creditLine) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one field (commissionRate or creditLine) must be provided",
          });
        }

        // Fetch the relationship
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

        // Verify authorization
        if (relationship.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to update this relationship",
          });
        }

        // Validate commission rate if provided
        if (input.commissionPercentage) {
          const commissionValue = parseFloat(input.commissionPercentage);
          if (commissionValue < 0 || commissionValue > 100) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Commission rate must be between 0 and 100",
            });
          }
        }

        // Validate credit line if provided
        if (input.creditLine) {
          const creditValue = parseFloat(input.creditLine);
          if (creditValue < 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Credit line must be a positive number",
            });
          }
        }

        // Update the relationship
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
   * 
   * Suspends a distributor relationship, preventing new transactions.
   * 
   * Authorization: Only the provider who owns the relationship can suspend it
   */
  suspendDistributor: protectedProcedure
    .input(
      z.object({
        relationshipId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const providerId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        // Fetch the relationship
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

        // Verify authorization
        if (relationship.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to suspend this relationship",
          });
        }

        // Verify relationship is active
        if (relationship.status !== "active") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot suspend a ${relationship.status} relationship`,
          });
        }

        // Suspend the relationship
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
   * 
   * Reactivates a suspended distributor relationship.
   * 
   * Authorization: Only the provider who owns the relationship can reactivate it
   */
  reactivateDistributor: protectedProcedure
    .input(
      z.object({
        relationshipId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const providerId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        // Fetch the relationship
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

        // Verify authorization
        if (relationship.providerId !== providerId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to reactivate this relationship",
          });
        }

        // Verify relationship is suspended
        if (relationship.status !== "suspended") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot reactivate a ${relationship.status} relationship`,
          });
        }

        // Reactivate the relationship
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
};
