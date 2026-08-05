import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getSessionCookieOptions } from "../_core/cookies";
import { z } from "zod";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const DEMO_ACCOUNTS = [
  {
    email: "admin@mostanad.ly",
    name: "Demo Provider User",
    role: "user" as const,
    organizationType: "provider" as const,
    description: "Provider account with access to provider dashboard and API management",
  },
  {
    email: "admin@distributer1.ly",
    name: "Demo Distributor User",
    role: "user" as const,
    organizationType: "distributor" as const,
    description: "Distributor account with access to purchase and transaction history",
  },
];

/**
 * Demo Login Router
 * 
 * Provides controlled access to seeded demo accounts for testing and client walkthroughs.
 * Only enabled when ENABLE_DEMO_LOGIN environment variable is set to "true".
 * 
 * Security:
 * - Gated behind environment flag (ENABLE_DEMO_LOGIN)
 * - Only works in non-production environments
 * - Limited to predefined demo accounts
 * - Logs all demo login attempts for audit
 */

export const demoAuthRouter = router({
  /**
   * Get list of available demo accounts
   * Only returns accounts if demo login is enabled
   */
  listDemoAccounts: publicProcedure.query(async () => {
    if (!ENV.enableDemoLogin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Demo login is not enabled",
      });
    }

    return DEMO_ACCOUNTS.map((account) => ({
      email: account.email,
      name: account.name,
      organizationType: account.organizationType,
      description: account.description,
    }));
  }),

  /**
   * Authenticate with a demo account
   * Creates a session cookie for the specified demo account
   */
  loginWithDemo: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email format"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ENV.enableDemoLogin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo login is not enabled",
        });
      }

      // Verify the email is in the allowed demo accounts
      const demoAccount = DEMO_ACCOUNTS.find((acc) => acc.email === input.email);
      if (!demoAccount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid demo account email",
        });
      }



      // Find the demo user by email
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection failed",
        });
      }

      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (userResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Demo user not found. Please run the seed script first.",
        });
      }

      const user = userResults[0];

      // Ensure openId exists (required for session token creation)
      if (!user.openId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Demo user openId is missing",
        });
      }

      // Create session token using SDK with the user's openId
      // This is the same mechanism used by OAuth
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);

      // Set session cookie with proper JWT token
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      // Log demo login attempt
      console.log(`[DEMO-LOGIN] User ${input.email} (ID: ${user.id}) logged in via demo login as ${demoAccount.organizationType}`);

      return {
        success: true,
        message: "Demo login successful",
        user: {
          id: user.id,
          email: user.email || "",
          name: user.name || "",
          role: user.role,
        },
      };
    }),

  /**
   * Check if demo login is enabled
   */
  isDemoLoginEnabled: publicProcedure.query(() => {
    return {
      enabled: ENV.enableDemoLogin,
      environment: ENV.isProduction ? "production" : "development",
    };
  }),
});
