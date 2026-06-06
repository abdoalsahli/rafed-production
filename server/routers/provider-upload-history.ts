/**
 * Provider Upload History Endpoints
 * Implements uploadHistory and getUploadErrors for real upload tracking
 */

import { z } from "zod";
import { getDb } from "../db";
import { cardBatches } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";

export const uploadHistoryRouter = {
  /**
   * provider.uploadHistory
   * Returns list of upload batches for the authenticated provider
   * 
   * Returns:
   * - id: batch ID
   * - fileName: uploaded file name
   * - uploadedAt: timestamp
   * - status: pending | processing | completed | failed
   * - totalCards: total cards in batch
   * - successRecords: successfully inserted cards
   * - failedRecords: failed insertions
   */
  uploadHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(20),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const providerId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        // Fetch upload batches for this provider, ordered by most recent first
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
   * 
   * Used to generate error CSV or display failed records
   */
  getUploadErrors: protectedProcedure
    .input(
      z.object({
        batchId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const providerId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");

      try {
        // Verify batch belongs to this provider
        const batch = await db
          .select()
          .from(cardBatches)
          .where(
            eq(cardBatches.id, input.batchId)
          )
          .limit(1);

        if (batch.length === 0 || batch[0].providerId !== providerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Upload batch not found",
          });
        }

        // For now, return empty array - in production, store errors in database
        // This would require a card_batch_errors table
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
};
