import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { WebhookResilienceService } from "../services/webhook.resilience";
import { getDb } from "../db";
import { organizations, distributors, organizationUsers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Webhook Resilience Router (Phase 12)
 * 
 * Provides tRPC endpoints for:
 * - Viewing dead-letter queue
 * - Manual webhook replay
 * - Delivery statistics
 * - Recent deliveries monitoring
 */

/**
 * Helper function to get distributor ID from user context
 */
async function getDistributorIdFromUser(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection not available");

  // Find user's organization
  const orgUsers = await db
    .select()
    .from(organizationUsers)
    .where(eq(organizationUsers.userId, userId))
    .limit(1);

  if (orgUsers.length === 0) {
    throw new Error("User not associated with any organization");
  }

  const orgUser = orgUsers[0];

  // Verify organization is a distributor
  const orgs = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.id, orgUser.organizationId),
        eq(organizations.type, "distributor")
      )
    )
    .limit(1);

  if (orgs.length === 0) {
    throw new Error("User is not a distributor");
  }

  const org = orgs[0];

  // Get distributor ID from organization
  // For now, we'll use a raw query since distributors table doesn't have organizationId
  const { getRawDb } = await import("../db");
  const pool = await getRawDb();
  if (!pool) throw new Error("Database connection not available");

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id FROM distributors WHERE name = ? LIMIT 1`,
      [org.name]
    );

    if (!rows || rows.length === 0) {
      throw new Error("Distributor not found");
    }

    return (rows[0] as any).id;
  } finally {
    conn.release();
  }
}

export const webhookResilienceRouter = router({
  /**
   * Get dead-letter queue for current distributor
   * 
   * Returns all permanently failed webhooks that can be manually replayed
   */
  getDeadLetterQueue: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }

      const distributorId = await getDistributorIdFromUser(ctx.user.id);
      return WebhookResilienceService.getDeadLetterQueue(distributorId);
    }),

  /**
   * Replay a failed webhook delivery
   * 
   * Resets a permanently failed webhook to PENDING and attempts immediate delivery
   * Only the distributor that owns the webhook can replay it
   */
  replayWebhook: protectedProcedure
    .input(
      z.object({
        deliveryId: z.number(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }

      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      return WebhookResilienceService.replayWebhook({
        deliveryId: input.deliveryId,
        distributorId,
        reason: input.reason,
      });
    }),

  /**
   * Get delivery statistics for current distributor
   * 
   * Returns counts and success/failure rates
   */
  getDeliveryStats: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }

      const distributorId = await getDistributorIdFromUser(ctx.user.id);
      return WebhookResilienceService.getDeliveryStats(distributorId);
    }),

  /**
   * Get recent webhook deliveries for monitoring
   * 
   * Returns the last N deliveries with status and response codes
   */
  getRecentDeliveries: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }

      const distributorId = await getDistributorIdFromUser(ctx.user.id);
      return WebhookResilienceService.getRecentDeliveries(
        distributorId,
        input.limit
      );
    }),

  /**
   * Get replay history for a specific webhook delivery
   * 
   * Returns all replay attempts and their outcomes
   */
  getReplayHistory: protectedProcedure
    .input(
      z.object({
        deliveryId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }

      return WebhookResilienceService.getReplayHistory(input.deliveryId);
    }),
});
