import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { distributorApiCredentials } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { getDistributorIdFromUser } from "../utils/org-lookup";

// Generate a random API key
function generateApiKey(): { keyId: string; secret: string; masked: string } {
  const keyId = `sk_live_${crypto.randomBytes(16).toString("hex")}`;
  const secret = crypto.randomBytes(32).toString("hex");
  const masked = `sk_live_${secret.slice(-12)}`;
  return { keyId, secret, masked };
}

// Generate an independent webhook signing secret
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
}

// Hash a secret for storage
function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

const getDistributorIdFromUserContext = getDistributorIdFromUser;

export const distributorApiRouter = router({
  // Get current API credentials for the authenticated distributor
  getCredentials: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      const distributorId = await getDistributorIdFromUserContext(ctx.user.id);

      const credentials = await db
        .select()
        .from(distributorApiCredentials)
        .where(
          and(
            eq(distributorApiCredentials.distributorId, distributorId),
            eq(distributorApiCredentials.status, "active")
          )
        )
        .limit(1);

      if (!credentials || credentials.length === 0) {
        return null;
      }

      const cred = credentials[0];
      return {
        id: cred.id,
        keyId: cred.keyId,
        maskedKey: cred.maskedKey,
        webhookUrl: cred.webhookUrl,
        lastUsedAt: cred.lastUsedAt,
        createdAt: cred.createdAt,
        status: cred.status,
      };
    } catch (error) {
      console.error("[API Credentials] Error fetching credentials:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch API credentials",
      });
    }
  }),

  // Generate a new API key
  generateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      const distributorId = await getDistributorIdFromUserContext(ctx.user.id);

      // Check if credentials already exist
      const existing = await db
        .select()
        .from(distributorApiCredentials)
        .where(
          and(
            eq(distributorApiCredentials.distributorId, distributorId),
            eq(distributorApiCredentials.status, "active")
          )
        )
        .limit(1);

      if (existing && existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Active API credentials already exist. Rotate the existing key instead.",
        });
      }

      const { keyId, secret, masked } = generateApiKey();
      const secretHash = hashSecret(secret);
      const webhookSecret = generateWebhookSecret();

      await db.insert(distributorApiCredentials).values({
        distributorId,
        keyId,
        maskedKey: masked,
        secretHash,
        webhookSecret,
        status: "active",
      });

      return {
        keyId,
        secret, // Only return the full secret on initial generation
        maskedKey: masked,
        webhookSecret, // Return once — distributor must save this for HMAC verification
        message: "API key generated successfully. Save the secret and webhookSecret in a secure location.",
      };
    } catch (error) {
      console.error("[API Credentials] Error generating key:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to generate API key",
      });
    }
  }),

  // Rotate API key (invalidate old, create new)
  rotateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      const distributorId = await getDistributorIdFromUserContext(ctx.user.id);

      // Find the active credential
      const existing = await db
        .select()
        .from(distributorApiCredentials)
        .where(
          and(
            eq(distributorApiCredentials.distributorId, distributorId),
            eq(distributorApiCredentials.status, "active")
          )
        )
        .limit(1);

      if (!existing || existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active API credentials found",
        });
      }

      const oldCred = existing[0];
      // Mark old credential as rotated
      await db
        .update(distributorApiCredentials)
        .set({ status: "rotated" })
        .where(eq(distributorApiCredentials.id, oldCred.id));

      // Generate new credential
      const { keyId, secret, masked } = generateApiKey();
      const secretHash = hashSecret(secret);
      const webhookSecret = generateWebhookSecret();

      await db.insert(distributorApiCredentials).values({
        distributorId,
        keyId,
        maskedKey: masked,
        secretHash,
        webhookSecret,
        status: "active",
      });

      return {
        keyId,
        secret,
        maskedKey: masked,
        webhookSecret, // New secret — distributor must update their HMAC verification
        message: "API key rotated successfully. The previous key is now inactive.",
      };
    } catch (error) {
      console.error("[API Credentials] Error rotating key:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to rotate API key",
      });
    }
  }),

  // Update webhook URL
  updateWebhookUrl: protectedProcedure
    .input(z.object({ webhookUrl: z.string().url().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const distributorId = await getDistributorIdFromUserContext(ctx.user.id);

        const credentials = await db
          .select()
          .from(distributorApiCredentials)
          .where(
            and(
              eq(distributorApiCredentials.distributorId, distributorId),
              eq(distributorApiCredentials.status, "active")
            )
          )
          .limit(1);

        if (!credentials || credentials.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active API credentials found",
          });
        }

        const cred = credentials[0];
        await db
          .update(distributorApiCredentials)
          .set({ webhookUrl: input.webhookUrl || null })
          .where(eq(distributorApiCredentials.id, cred.id));

        return {
          success: true,
          webhookUrl: input.webhookUrl,
          message: "Webhook URL updated successfully.",
        };
      } catch (error) {
        console.error("[API Credentials] Error updating webhook:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update webhook URL",
        });
      }
    }),

  // Get API usage logs (recent requests)
  getApiLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const distributorId = await getDistributorIdFromUserContext(ctx.user.id);

        const credentials = await db
          .select()
          .from(distributorApiCredentials)
          .where(
            and(
              eq(distributorApiCredentials.distributorId, distributorId),
              eq(distributorApiCredentials.status, "active")
            )
          )
          .limit(1);

        if (!credentials || credentials.length === 0) {
          return [];
        }

        // For now, return empty array - this would be populated by API request logging
        // In a full implementation, you'd query an api_logs table
        return [];
      } catch (error) {
        console.error("[API Credentials] Error fetching logs:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch API logs",
        });
      }
    }),
});
