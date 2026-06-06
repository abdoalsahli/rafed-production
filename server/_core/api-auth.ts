import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getDb, getRawDb } from "../db";
import { distributorApiCredentials } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Hash a secret using SHA256 (same as distributor-api.router.ts)
 */
function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/**
 * API authentication context
 */
export interface ApiAuthContext {
  distributorId: number;
  credentialId: number;
  keyId: string;
}

/**
 * Authenticate API request using X-API-Key and X-API-Secret headers
 */
export async function authenticateApiRequest(
  req: Request
): Promise<ApiAuthContext> {
  const apiKey = req.headers["x-api-key"] as string;
  const apiSecret = req.headers["x-api-secret"] as string;

  // Validate headers exist
  if (!apiKey || !apiSecret) {
    const error = new Error("Missing API credentials");
    (error as any).statusCode = 401;
    (error as any).code = "MISSING_CREDENTIALS";
    throw error;
  }

  // Validate key format (accept sk_live_ prefix or plain key_id)
  if (!apiKey.startsWith("sk_live_") && !apiKey.startsWith("key_")) {
    const error = new Error("Invalid API key format");
    (error as any).statusCode = 401;
    (error as any).code = "INVALID_API_KEY_FORMAT";
    throw error;
  }
  
  // Use the key as-is for database lookup (keys are stored exactly as provided)
  const lookupKey = apiKey;

  try {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    // Find credential by key_id
    const credentials = await db
      .select({
        id: distributorApiCredentials.id,
        distributorId: distributorApiCredentials.distributorId,
        keyId: distributorApiCredentials.keyId,
        maskedKey: distributorApiCredentials.maskedKey,
        secretHash: distributorApiCredentials.secretHash,
        status: distributorApiCredentials.status,
        webhookUrl: distributorApiCredentials.webhookUrl,
        lastUsedAt: distributorApiCredentials.lastUsedAt,
        createdAt: distributorApiCredentials.createdAt,
        updatedAt: distributorApiCredentials.updatedAt,
      })
      .from(distributorApiCredentials)
      .where(eq(distributorApiCredentials.keyId, lookupKey));

    if (!credentials || credentials.length === 0) {
      const error = new Error("Invalid API credentials");
      (error as any).statusCode = 401;
      (error as any).code = "INVALID_API_CREDENTIALS";
      throw error;
    }

    const credential = credentials[0];

    // Check if credential is active
    if (credential.status !== "active") {
      const error = new Error("API credential is inactive");
      (error as any).statusCode = 403;
      (error as any).code = "INACTIVE_CREDENTIAL";
      throw error;
    }

    // Hash provided secret and compare with timing-safe comparison
    const secretHash = hashSecret(apiSecret);
    const isValid = timingSafeCompare(secretHash, credential.secretHash);

    if (!isValid) {
      const error = new Error("Invalid API credentials");
      (error as any).statusCode = 401;
      (error as any).code = "INVALID_API_CREDENTIALS";
      throw error;
    }

    // Update last_used_at
    try {
      await db
        .update(distributorApiCredentials)
        .set({ lastUsedAt: new Date() })
        .where(eq(distributorApiCredentials.id, credential.id));
    } catch (err) {
      console.error("[API Auth] Failed to update last_used_at:", err);
      // Don't fail the request if we can't update last_used_at
    }

    return {
      distributorId: credential.distributorId,
      credentialId: credential.id,
      keyId: credential.keyId,
    };
  } catch (error) {
    if ((error as any).statusCode) {
      throw error;
    }
    console.error("[API Auth] Unexpected error during authentication:", error);
    const err = new Error("Authentication failed");
    (err as any).statusCode = 500;
    (err as any).code = "AUTH_ERROR";
    throw err;
  }
}

/**
 * Express middleware for API authentication
 */
export function apiAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Attach auth context to request
  authenticateApiRequest(req)
    .then((authContext) => {
      (req as any).apiAuth = authContext;
      next();
    })
    .catch((error) => {
      const statusCode = (error as any).statusCode || 500;
      const code = (error as any).code || "UNKNOWN_ERROR";
      
      res.status(statusCode).json({
        success: false,
        error: {
          code,
          message: error.message,
        },
      });
    });
}
