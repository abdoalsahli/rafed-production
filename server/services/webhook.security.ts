import crypto from "crypto";

/**
 * Webhook Security Service
 * 
 * Handles:
 * - Webhook signature generation (HMAC SHA256)
 * - Webhook signature verification
 * - Timestamp validation
 * - Event ID generation for replay protection
 * 
 * Security requirements:
 * - All webhooks must be signed with HMAC SHA256
 * - Signature includes timestamp + raw request body
 * - Timestamp must be recent (within 5 minutes) to prevent replay attacks
 * - Each webhook must have unique eventId to prevent replay attacks
 * - Use dedicated webhook secret for signing (separate from API secret)
 * - Include X-Webhook-Version header for future compatibility
 */

export class WebhookSecurityService {
  /**
   * Generate unique event ID for webhook
   * Format: evt_{timestamp}_{random}
   * 
   * Used for replay attack prevention. Distributors should:
   * - Store received eventIds
   * - Reject duplicate eventIds
   * - Reject eventIds older than 5 minutes
   * 
   * @returns Unique event ID string
   */
  static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate webhook signature
   * 
   * Signature = HMAC-SHA256(secret, timestamp + "." + body)
   * 
   * @param timestamp ISO timestamp string
   * @param body Raw request body as string
   * @param secret Webhook secret (dedicated, separate from API secret)
   * @returns Signature string (hex encoded)
   */
  static generateSignature(
    timestamp: string,
    body: string,
    secret: string
  ): string {
    const signatureData = `${timestamp}.${body}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(signatureData)
      .digest("hex");
    return signature;
  }

  /**
   * Verify webhook signature
   * 
   * @param signature Signature from X-Webhook-Signature header
   * @param timestamp Timestamp from X-Webhook-Timestamp header
   * @param body Raw request body as string
   * @param secret Webhook secret (dedicated, separate from API secret)
   * @param maxAgeSeconds Maximum age of timestamp (default 300 = 5 minutes)
   * @returns true if signature is valid and timestamp is recent
   */
  static verifySignature(
    signature: string,
    timestamp: string,
    body: string,
    secret: string,
    maxAgeSeconds: number = 300
  ): boolean {
    // Verify timestamp is recent (prevent replay attacks)
    if (!this.isTimestampRecent(timestamp, maxAgeSeconds)) {
      console.warn(
        "[Webhook Security] Rejected webhook: timestamp too old",
        timestamp
      );
      return false;
    }

    // Verify signature
    const expectedSignature = this.generateSignature(timestamp, body, secret);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.warn(
        "[Webhook Security] Rejected webhook: invalid signature"
      );
    }

    return isValid;
  }

  /**
   * Check if timestamp is recent
   * 
   * @param timestamp ISO timestamp string
   * @param maxAgeSeconds Maximum age in seconds (default 300 = 5 minutes)
   * @returns true if timestamp is within max age
   */
  static isTimestampRecent(
    timestamp: string,
    maxAgeSeconds: number = 300
  ): boolean {
    try {
      const timestampMs = new Date(timestamp).getTime();
      const nowMs = Date.now();
      const ageMs = nowMs - timestampMs;
      const maxAgeMs = maxAgeSeconds * 1000;

      return ageMs >= 0 && ageMs <= maxAgeMs;
    } catch (error) {
      console.warn("[Webhook Security] Invalid timestamp format:", timestamp);
      return false;
    }
  }

  /**
   * Generate webhook headers for outgoing webhook request
   * 
   * Headers include:
   * - X-Webhook-Timestamp: ISO 8601 timestamp
   * - X-Webhook-Signature: HMAC-SHA256 signature
   * - X-Webhook-Version: API version (v1)
   * - X-Webhook-Event-ID: Unique event ID for replay protection
   * - Content-Type: application/json
   * 
   * @param body Raw request body as string
   * @param secret Webhook secret (dedicated, separate from API secret)
   * @param eventId Optional event ID (generated if not provided)
   * @returns Object with all webhook headers
   */
  static generateHeaders(
    body: string,
    secret: string,
    eventId?: string
  ): {
    "X-Webhook-Timestamp": string;
    "X-Webhook-Signature": string;
    "X-Webhook-Version": string;
    "X-Webhook-Event-ID": string;
    "Content-Type": string;
  } {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(timestamp, body, secret);
    const finalEventId = eventId || this.generateEventId();

    return {
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Signature": signature,
      "X-Webhook-Version": "v1",
      "X-Webhook-Event-ID": finalEventId,
      "Content-Type": "application/json",
    };
  }
}
