import { getDb, getRawDb } from "../db";
import { webhookDeliveries, webhookEvents } from "../../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";
import { WebhookSecurityService } from "./webhook.security";

/**
 * Webhook Delivery Service
 * 
 * Manages:
 * - Webhook event creation
 * - Webhook delivery attempts
 * - Retry logic with exponential backoff
 * - Delivery status tracking
 * 
 * CRITICAL: Webhooks are sent AFTER transaction commit, never inside transaction
 */

export interface WebhookPayload {
  eventId: string; // Unique event ID for replay protection
  event: "purchase.succeeded" | "purchase.failed";
  requestId: number;
  providerId: number;
  providerCode?: string;
  providerName?: string;
  productId: number;
  productName?: string;
  amount?: string;
  serial?: string;
  pin?: string;
  status: string;
  reason?: string; // For failed purchases
  timestamp: string;
}

// Retry schedule in seconds
const RETRY_SCHEDULE = [30, 120, 600, 3600, 21600]; // 30s, 2m, 10m, 1h, 6h

export class WebhookDeliveryService {
  /**
   * Create webhook event and queue for delivery
   * 
   * This should be called AFTER the purchase transaction completes successfully.
   * 
   * @param distributorId Distributor ID
   * @param purchaseRequestId Purchase request ID
   * @param eventType Event type (purchase.succeeded or purchase.failed)
   * @param payload Webhook payload
   * @param webhookUrl Target webhook URL
   * @param webhookSecret Webhook secret for signing
   */
  static async createAndQueueWebhook(
    distributorId: number,
    purchaseRequestId: number,
    eventType: "purchase.succeeded" | "purchase.failed",
    payload: WebhookPayload,
    webhookUrl: string,
    webhookSecret: string
  ): Promise<{ deliveryId: number }> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    const payloadJson = JSON.stringify(payload);

    try {
      // Create webhook event record (for audit)
      await db.insert(webhookEvents).values({
        distributorId,
        purchaseRequestId,
        eventType,
        payloadJson,
      });

      // Create webhook delivery record (initial PENDING state)
      const deliveryResult = await db.insert(webhookDeliveries).values({
        distributorId,
        purchaseRequestId,
        eventType,
        targetUrl: webhookUrl,
        payloadJson,
        deliveryStatus: "PENDING",
        retryCount: 0,
        nextRetryAt: new Date(), // Attempt immediately
      });

      const deliveryId = (deliveryResult as any).insertId || 0;

      console.log(
        `[Webhook] Created delivery record ${deliveryId} for distributor ${distributorId}, purchase ${purchaseRequestId}`
      );

      // Queue delivery attempt (async, non-blocking)
      this.attemptDelivery(deliveryId, webhookUrl, payloadJson, webhookSecret)
        .catch((error) => {
          console.error(
            `[Webhook] Error during delivery attempt for ${deliveryId}:`,
            error
          );
        });

      return { deliveryId };
    } catch (error) {
      console.error("[Webhook] Error creating webhook event:", error);
      throw error;
    }
  }

  /**
   * Attempt to deliver webhook
   * 
   * @param deliveryId Webhook delivery ID
   * @param webhookUrl Target URL
   * @param payloadJson Payload JSON string
   * @param webhookSecret Secret for signing
   */
  static async attemptDelivery(
    deliveryId: number,
    webhookUrl: string,
    payloadJson: string,
    webhookSecret: string
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
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: headers, // Headers already include Content-Type from generateHeaders
          body: payloadJson,
          signal: controller.signal,
        });

        const responseBody = await response.text();
        const statusCode = response.status;

        console.log(
          `[Webhook] Delivery ${deliveryId} attempt: ${statusCode}`,
          responseBody.slice(0, 200)
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
            })
            .where(eq(webhookDeliveries.id, deliveryId));

          console.log(`[Webhook] Delivery ${deliveryId} succeeded`);
        } else {
          // Failure - determine if retryable
          await this.handleDeliveryFailure(
            deliveryId,
            statusCode,
            responseBody
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Network error or timeout - retryable
      console.error(`[Webhook] Delivery ${deliveryId} network error:`, error);
      await this.handleDeliveryFailure(
        deliveryId,
        0,
        error instanceof Error ? error.message : "Network error"
      );
    }
  }

  /**
   * Handle delivery failure
   * 
   * Determines if failure is retryable and schedules next retry
   */
  private static async handleDeliveryFailure(
    deliveryId: number,
    statusCode: number,
    responseBody: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    // Fetch current delivery record
    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId))
      .limit(1);

    if (deliveries.length === 0) {
      console.error(`[Webhook] Delivery ${deliveryId} not found`);
      return;
    }

    const delivery = deliveries[0];
    const currentRetryCount = delivery.retryCount || 0;

    // Check if retryable
    const isRetryable = this.isRetryable(statusCode);

    if (!isRetryable) {
      // Not retryable - mark as failed
      console.log(
        `[Webhook] Delivery ${deliveryId} failed permanently (status ${statusCode})`
      );

      await db
        .update(webhookDeliveries)
        .set({
          deliveryStatus: "FAILED_DELIVERY",
          responseStatus: statusCode,
          responseBody: responseBody.slice(0, 4096),
          failedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      return;
    }

    // Retryable - schedule next attempt
    if (currentRetryCount >= RETRY_SCHEDULE.length) {
      // Max retries exceeded
      console.log(
        `[Webhook] Delivery ${deliveryId} max retries exceeded (${currentRetryCount})`
      );

      await db
        .update(webhookDeliveries)
        .set({
          deliveryStatus: "FAILED_DELIVERY",
          responseStatus: statusCode,
          responseBody: responseBody.slice(0, 4096),
          failedAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      return;
    }

    // Schedule next retry
    const nextRetryDelaySeconds = RETRY_SCHEDULE[currentRetryCount];
    const nextRetryAt = new Date(Date.now() + nextRetryDelaySeconds * 1000);

    console.log(
      `[Webhook] Delivery ${deliveryId} scheduled for retry in ${nextRetryDelaySeconds}s`
    );

    await db
      .update(webhookDeliveries)
      .set({
        retryCount: currentRetryCount + 1,
        responseStatus: statusCode,
        responseBody: responseBody.slice(0, 4096),
        nextRetryAt,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  }

  /**
   * Determine if HTTP status code is retryable
   * 
   * Retry on:
   * - 5xx errors (server errors)
   * - Timeout (0)
   * - Network errors
   * 
   * Don't retry on:
   * - 4xx errors (client errors - likely permanent)
   * - 2xx/3xx (success or redirect)
   */
  private static isRetryable(statusCode: number): boolean {
    if (statusCode === 0) return true; // Network error/timeout
    if (statusCode >= 500) return true; // Server error
    return false; // All other status codes are not retryable
  }

  /**
   * Process pending webhook deliveries
   * 
   * This should be called by a background job/worker periodically
   * (e.g., every 30 seconds)
   */
  static async processPendingDeliveries(): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      // Find deliveries that are ready for retry
      const pendingDeliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.deliveryStatus, "PENDING"),
            lte(webhookDeliveries.nextRetryAt, new Date())
          )
        )
        .limit(100); // Process max 100 at a time

      console.log(
        `[Webhook] Processing ${pendingDeliveries.length} pending deliveries`
      );

      for (const delivery of pendingDeliveries) {
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
              console.warn(
                `[Webhook] No active credentials found for distributor ${delivery.distributorId}`
              );
              continue;
            }

            // Note: In production, you'd need to store the actual secret or derive it
            // For now, we'll use the secretHash as a placeholder
            const webhookSecret = credRows[0].secret_hash;

            await this.attemptDelivery(
              delivery.id,
              delivery.targetUrl,
              delivery.payloadJson,
              webhookSecret
            );
          } finally {
            conn.release();
          }
        } catch (error) {
          console.error(
            `[Webhook] Error processing delivery ${delivery.id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[Webhook] Error processing pending deliveries:", error);
    }
  }
}
