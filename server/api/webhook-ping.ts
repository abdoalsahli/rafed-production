import { Request, Response } from "express";
import { getDb } from "../db";
import { distributorApiCredentials } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { WebhookSecurityService } from "../services/webhook.security";

/**
 * POST /api/v1/webhooks/test
 *
 * Sends a signed test event to the distributor's configured webhook URL.
 * Lets integrators verify their endpoint and HMAC validation logic without
 * triggering a real purchase.
 *
 * Returns the HTTP status code and response body received from the target,
 * so the distributor can see exactly what their server responded with.
 */
export async function handleWebhookPing(
  req: Request,
  res: Response
): Promise<void> {
  const apiAuth = (req as any).apiAuth;
  if (!apiAuth) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "API authentication required" },
    });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(500).json({
      success: false,
      error: { code: "DATABASE_ERROR", message: "Database connection unavailable" },
    });
    return;
  }

  const credentials = await db
    .select()
    .from(distributorApiCredentials)
    .where(
      and(
        eq(distributorApiCredentials.distributorId, apiAuth.distributorId),
        eq(distributorApiCredentials.status, "active")
      )
    )
    .limit(1);

  if (!credentials || credentials.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: "NO_CREDENTIALS", message: "No active API credentials found" },
    });
    return;
  }

  const cred = credentials[0];

  if (!cred.webhookUrl) {
    res.status(422).json({
      success: false,
      error: {
        code: "NO_WEBHOOK_URL",
        message: "No webhook URL configured. Set one via the dashboard before testing.",
      },
    });
    return;
  }

  const payload = {
    eventId: WebhookSecurityService.generateEventId(),
    event: "webhook.test",
    distributorId: apiAuth.distributorId,
    message: "This is a test event from Rafed. If you received it, your webhook endpoint is working correctly.",
    timestamp: new Date().toISOString(),
  };
  const payloadJson = JSON.stringify(payload);

  const signingSecret = cred.webhookSecret ?? cred.secretHash;
  const headers = WebhookSecurityService.generateHeaders(payloadJson, signingSecret);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let responseStatus: number;
    let responseBody: string;

    try {
      const response = await fetch(cred.webhookUrl, {
        method: "POST",
        headers,
        body: payloadJson,
        signal: controller.signal,
      });
      responseStatus = response.status;
      responseBody = (await response.text()).slice(0, 1024);
    } finally {
      clearTimeout(timeoutId);
    }

    res.status(200).json({
      success: true,
      webhookUrl: cred.webhookUrl,
      responseStatus,
      responseBody,
      payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    res.status(200).json({
      success: false,
      webhookUrl: cred.webhookUrl,
      error: {
        code: "DELIVERY_FAILED",
        message,
      },
      payload,
    });
  }
}
