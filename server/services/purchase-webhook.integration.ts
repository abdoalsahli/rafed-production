import { getDb, getRawDb } from "../db";
import { WebhookDeliveryService, WebhookPayload } from "./webhook.delivery";
import { WebhookSecurityService } from "./webhook.security";
import { distributorApiCredentials, products, serviceProviders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Purchase Webhook Integration Service
 * 
 * Handles webhook creation and delivery for purchase completion events.
 * 
 * CRITICAL: This service is called AFTER purchase transaction commits.
 * Webhook failures NEVER affect purchase success.
 */

export class PurchaseWebhookIntegration {
  /**
   * Handle purchase success - create webhook event
   * 
   * Called AFTER purchase is marked as SUCCEEDED in database
   * Webhook delivery is async and non-blocking
   * 
   * @param purchaseRequestId Purchase request ID
   * @param providerId Provider ID
   * @param distributorId Distributor ID
   * @param productId Product ID
   * @param cardSerial Card serial number (if available)
   * @param cardPin Card PIN (if available)
   */
  static async onPurchaseSucceeded(
    purchaseRequestId: number,
    providerId: number,
    distributorId: number,
    productId: number,
    cardSerial?: string,
  ): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("[Webhook Integration] Database not available for success webhook");
        return;
      }

      // Fetch distributor API credentials (webhook URL and secret)
      const credentials = await db
        .select()
        .from(distributorApiCredentials)
        .where(eq(distributorApiCredentials.distributorId, distributorId))
        .limit(1);

      if (!credentials || credentials.length === 0) {
        console.log(
          `[Webhook Integration] No webhook URL configured for distributor ${distributorId}`
        );
        return;
      }

      const cred = credentials[0];
      if (!cred.webhookUrl) {
        console.log(
          `[Webhook Integration] Webhook URL not set for distributor ${distributorId}`
        );
        return;
      }

      // Fetch product details
      const productList = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      const product = productList[0];

      // Fetch provider details
      const providerList = await db
        .select()
        .from(serviceProviders)
        .where(eq(serviceProviders.id, providerId))
        .limit(1);

      const provider = providerList[0];

      // Build webhook payload with eventId for replay protection
      // PIN is intentionally excluded from the webhook payload.
      // Distributors must call GET /api/v1/purchases/:requestId to retrieve the PIN
      // via the one-time atomic reveal mechanism.
      const payload: WebhookPayload = {
        eventId: WebhookSecurityService.generateEventId(),
        event: "purchase.succeeded",
        requestId: purchaseRequestId,
        providerId,
        providerCode: provider?.providerCode,
        providerName: provider?.name,
        productId,
        productName: product?.name,
        amount: product?.price?.toString(),
        serial: cardSerial,
        status: "SUCCEEDED",
        timestamp: new Date().toISOString(),
      };

      // Queue webhook delivery (async, non-blocking)
      const signingSecret = cred.webhookSecret ?? cred.secretHash;
      await WebhookDeliveryService.createAndQueueWebhook(
        distributorId,
        purchaseRequestId,
        "purchase.succeeded",
        payload,
        cred.webhookUrl,
        signingSecret,
      );

      console.log(
        `[Webhook Integration] Queued success webhook for purchase ${purchaseRequestId}`
      );
    } catch (error) {
      // Log error but don't throw - webhook failures must not affect purchase
      console.error(
        `[Webhook Integration] Error queuing success webhook for purchase ${purchaseRequestId}:`,
        error
      );
    }
  }

  /**
   * Handle purchase failure - create webhook event
   * 
   * Called AFTER purchase is marked as FAILED in database
   * Webhook delivery is async and non-blocking
   * 
   * @param purchaseRequestId Purchase request ID
   * @param providerId Provider ID
   * @param distributorId Distributor ID
   * @param productId Product ID
   * @param failureReason Reason for failure
   */
  static async onPurchaseFailed(
    purchaseRequestId: number,
    providerId: number,
    distributorId: number,
    productId: number,
    failureReason?: string
  ): Promise<void> {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("[Webhook Integration] Database not available for failure webhook");
        return;
      }

      // Fetch distributor API credentials
      const credentials = await db
        .select()
        .from(distributorApiCredentials)
        .where(eq(distributorApiCredentials.distributorId, distributorId))
        .limit(1);

      if (!credentials || credentials.length === 0) {
        console.log(
          `[Webhook Integration] No webhook URL configured for distributor ${distributorId}`
        );
        return;
      }

      const cred = credentials[0];
      if (!cred.webhookUrl) {
        console.log(
          `[Webhook Integration] Webhook URL not set for distributor ${distributorId}`
        );
        return;
      }

      // Fetch product details
      const productList = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      const product = productList[0];

      // Fetch provider details
      const providerList = await db
        .select()
        .from(serviceProviders)
        .where(eq(serviceProviders.id, providerId))
        .limit(1);

      const provider = providerList[0];

      // Build webhook payload with eventId for replay protection
      const payload: WebhookPayload = {
        eventId: WebhookSecurityService.generateEventId(),
        event: "purchase.failed",
        requestId: purchaseRequestId,
        providerId,
        providerCode: provider?.providerCode,
        providerName: provider?.name,
        productId,
        productName: product?.name,
        amount: product?.price?.toString(),
        status: "FAILED",
        reason: failureReason || "Unknown error",
        timestamp: new Date().toISOString(),
      };

      // Queue webhook delivery (async, non-blocking)
      const signingSecret = cred.webhookSecret ?? cred.secretHash;
      await WebhookDeliveryService.createAndQueueWebhook(
        distributorId,
        purchaseRequestId,
        "purchase.failed",
        payload,
        cred.webhookUrl,
        signingSecret,
      );

      console.log(
        `[Webhook Integration] Queued failure webhook for purchase ${purchaseRequestId}`
      );
    } catch (error) {
      // Log error but don't throw - webhook failures must not affect purchase
      console.error(
        `[Webhook Integration] Error queuing failure webhook for purchase ${purchaseRequestId}:`,
        error
      );
    }
  }
}
