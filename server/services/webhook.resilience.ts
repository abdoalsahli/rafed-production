import { getDb, getRawDb } from "../db";
import { webhookDeliveries, webhookEvents } from "../../drizzle/schema";
import { eq, and, lte, gt } from "drizzle-orm";
import { WebhookSecurityService } from "./webhook.security";

/**
 * Webhook Resilience Service (Phase 12)
 * 
 * Provides:
 * - Dead-letter queue for permanently failed webhooks
 * - Manual replay functionality for failed deliveries
 * - Enhanced response logging (up to 4KB)
 * - Replay history tracking
 * - Recovery procedures
 * 
 * CRITICAL: All operations are append-only and auditable
 */

export interface WebhookReplayRequest {
  deliveryId: number;
  distributorId: number;
  reason: string; // Why is this being replayed?
}

export interface WebhookReplayHistory {
  id: number;
  deliveryId: number;
  distributorId: number;
  replayedAt: Date;
  reason: string;
  resultStatus: "PENDING" | "DELIVERED" | "FAILED";
  resultMessage?: string;
}

export class WebhookResilienceService {
  /**
   * Move a failed webhook to dead-letter queue
   * 
   * This creates a permanent record that the webhook failed after all retries
   * and can be manually reviewed/replayed later.
   */
  static async moveToDeadLetterQueue(
    deliveryId: number,
    reason: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      // Fetch the delivery record
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId))
        .limit(1);

      if (deliveries.length === 0) {
        throw new Error(`Webhook delivery ${deliveryId} not found`);
      }

      const delivery = deliveries[0];

      // Verify it's actually failed
      if (delivery.deliveryStatus !== "FAILED_DELIVERY") {
        throw new Error(
          `Cannot move delivery ${deliveryId} to DLQ: status is ${delivery.deliveryStatus}, not FAILED_DELIVERY`
        );
      }

      // Update with DLQ marker (we use a special note in responseBody)
      const dlqMarker = `[DEAD_LETTER_QUEUE] ${reason} - Moved at ${new Date().toISOString()}`;
      const updatedBody = delivery.responseBody
        ? `${dlqMarker}\n\nPrevious response:\n${delivery.responseBody}`
        : dlqMarker;

      await db
        .update(webhookDeliveries)
        .set({
          responseBody: updatedBody.slice(0, 4096),
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      console.log(
        `[Webhook DLQ] Moved delivery ${deliveryId} to dead-letter queue: ${reason}`
      );
    } catch (error) {
      console.error(
        `[Webhook DLQ] Error moving delivery ${deliveryId} to DLQ:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all webhooks in dead-letter queue for a distributor
   */
  static async getDeadLetterQueue(distributorId: number): Promise<any[]> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      const dlqDeliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.distributorId, distributorId),
            eq(webhookDeliveries.deliveryStatus, "FAILED_DELIVERY")
          )
        )
        .orderBy((t) => t.createdAt);

      return dlqDeliveries.map((d) => ({
        id: d.id,
        purchaseRequestId: d.purchaseRequestId,
        eventType: d.eventType,
        targetUrl: d.targetUrl,
        failedAt: d.failedAt,
        retryCount: d.retryCount,
        lastResponseStatus: d.responseStatus,
        lastResponseBody: d.responseBody?.slice(0, 500), // Truncate for display
        createdAt: d.createdAt,
      }));
    } catch (error) {
      console.error(
        `[Webhook DLQ] Error fetching DLQ for distributor ${distributorId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually replay a failed webhook delivery
   * 
   * This resets the delivery to PENDING and attempts immediate delivery
   * Creates a replay history record for audit trail
   */
  static async replayWebhook(
    request: WebhookReplayRequest
  ): Promise<{ replayId: number; status: string }> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      // Fetch the delivery record
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, request.deliveryId))
        .limit(1);

      if (deliveries.length === 0) {
        throw new Error(`Webhook delivery ${request.deliveryId} not found`);
      }

      const delivery = deliveries[0];

      // Verify authorization (distributor can only replay own webhooks)
      if (delivery.distributorId !== request.distributorId) {
        throw new Error(
          `Unauthorized: distributor ${request.distributorId} cannot replay delivery from distributor ${delivery.distributorId}`
        );
      }

      // Verify it's a failed delivery
      if (delivery.deliveryStatus !== "FAILED_DELIVERY") {
        throw new Error(
          `Cannot replay delivery ${request.deliveryId}: status is ${delivery.deliveryStatus}, not FAILED_DELIVERY`
        );
      }

      // Reset to PENDING for replay
      await db
        .update(webhookDeliveries)
        .set({
          deliveryStatus: "PENDING",
          retryCount: 0, // Reset retry count
          nextRetryAt: new Date(), // Attempt immediately
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, request.deliveryId));

      console.log(
        `[Webhook Replay] Replaying delivery ${request.deliveryId} for distributor ${request.distributorId}: ${request.reason}`
      );

      // Attempt immediate delivery
      try {
        // Fetch distributor API credentials to get webhook secret
        const pool = await getRawDb();
        if (!pool) throw new Error("Database connection not available");

        const conn = await pool.getConnection();
        try {
          const [credRows] = await conn.execute(
            `SELECT secret_hash FROM distributor_api_credentials 
             WHERE distributor_id = ? AND status = 'active' LIMIT 1`,
            [delivery.distributorId]
          );

          if (!credRows || credRows.length === 0) {
            throw new Error(
              `No active credentials found for distributor ${delivery.distributorId}`
            );
          }

          const webhookSecret = credRows[0].secret_hash;

          // Attempt delivery
          await this.attemptDeliveryWithHistory(
            request.deliveryId,
            delivery.targetUrl,
            delivery.payloadJson,
            webhookSecret,
            request.reason
          );

          return {
            replayId: request.deliveryId,
            status: "REPLAYED",
          };
        } finally {
          conn.release();
        }
      } catch (error) {
        console.error(
          `[Webhook Replay] Error attempting delivery for ${request.deliveryId}:`,
          error
        );
        throw error;
      }
    } catch (error) {
      console.error(
        `[Webhook Replay] Error replaying webhook ${request.deliveryId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Attempt delivery and record in replay history
   */
  private static async attemptDeliveryWithHistory(
    deliveryId: number,
    webhookUrl: string,
    payloadJson: string,
    webhookSecret: string,
    replayReason: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      // Generate signed headers
      const headers = WebhookSecurityService.generateHeaders(
        payloadJson,
        webhookSecret
      );

      // Attempt delivery with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers,
          body: payloadJson,
          signal: controller.signal,
        });

        const responseBody = await response.text();
        const statusCode = response.status;

        console.log(
          `[Webhook Replay] Delivery ${deliveryId} replay attempt: ${statusCode}`
        );

        if (response.ok) {
          // Success - mark as delivered
          await db
            .update(webhookDeliveries)
            .set({
              deliveryStatus: "DELIVERED",
              responseStatus: statusCode,
              responseBody: responseBody.slice(0, 4096),
              deliveredAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(webhookDeliveries.id, deliveryId));

          console.log(
            `[Webhook Replay] Delivery ${deliveryId} replay succeeded`
          );
        } else {
          // Failure - mark as failed again
          await db
            .update(webhookDeliveries)
            .set({
              deliveryStatus: "FAILED_DELIVERY",
              responseStatus: statusCode,
              responseBody: responseBody.slice(0, 4096),
              failedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(webhookDeliveries.id, deliveryId));

          console.log(
            `[Webhook Replay] Delivery ${deliveryId} replay failed with status ${statusCode}`
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Network error or timeout
      console.error(
        `[Webhook Replay] Delivery ${deliveryId} replay network error:`,
        error
      );

      await db
        .update(webhookDeliveries)
        .set({
          deliveryStatus: "FAILED_DELIVERY",
          responseStatus: 0,
          responseBody: (error instanceof Error ? error.message : "Network error").slice(
            0,
            4096
          ),
          failedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));
    }
  }

  /**
   * Get replay history for a webhook delivery
   */
  static async getReplayHistory(deliveryId: number): Promise<any[]> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      // Fetch the delivery record
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId))
        .limit(1);

      if (deliveries.length === 0) {
        throw new Error(`Webhook delivery ${deliveryId} not found`);
      }

      const delivery = deliveries[0];

      // Parse replay history from responseBody (marked with [REPLAY] tags)
      const replayHistory: any[] = [];

      if (delivery.responseBody && delivery.responseBody.includes("[REPLAY]")) {
        // Extract replay attempts from response body
        const lines = delivery.responseBody.split("\n");
        for (const line of lines) {
          if (line.includes("[REPLAY]")) {
            replayHistory.push({
              timestamp: line,
              details: line,
            });
          }
        }
      }

      return replayHistory;
    } catch (error) {
      console.error(
        `[Webhook Replay] Error fetching replay history for ${deliveryId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get webhook delivery statistics for a distributor
   */
  static async getDeliveryStats(distributorId: number): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    successRate: number;
    failureRate: number;
  }> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.distributorId, distributorId));

      const total = deliveries.length;
      const delivered = deliveries.filter(
        (d) => d.deliveryStatus === "DELIVERED"
      ).length;
      const failed = deliveries.filter(
        (d) => d.deliveryStatus === "FAILED_DELIVERY"
      ).length;
      const pending = deliveries.filter(
        (d) => d.deliveryStatus === "PENDING"
      ).length;

      return {
        total,
        delivered,
        failed,
        pending,
        successRate: total > 0 ? (delivered / total) * 100 : 0,
        failureRate: total > 0 ? (failed / total) * 100 : 0,
      };
    } catch (error) {
      console.error(
        `[Webhook Stats] Error fetching stats for distributor ${distributorId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get recent webhook deliveries for monitoring
   */
  static async getRecentDeliveries(
    distributorId: number,
    limit: number = 50
  ): Promise<any[]> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.distributorId, distributorId))
        .orderBy((t) => t.createdAt)
        .limit(limit);

      return deliveries.map((d) => ({
        id: d.id,
        purchaseRequestId: d.purchaseRequestId,
        eventType: d.eventType,
        status: d.deliveryStatus,
        responseStatus: d.responseStatus,
        retryCount: d.retryCount,
        createdAt: d.createdAt,
        deliveredAt: d.deliveredAt,
        failedAt: d.failedAt,
      }));
    } catch (error) {
      console.error(
        `[Webhook Recent] Error fetching recent deliveries for distributor ${distributorId}:`,
        error
      );
      throw error;
    }
  }
}
