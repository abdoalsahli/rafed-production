/**
 * Email/Password Authentication Router
 * 
 * Handles email signup and login flows with bcrypt password hashing.
 * Users created via email signup start in PENDING status and require admin activation.
 */

import { z } from "zod";
import bcrypt from "bcrypt";
import { publicProcedure, router } from "../_core/trpc";
import { getRawDb } from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { TRPCError } from "@trpc/server";
import { sdk } from "../_core/sdk";

const SALT_ROUNDS = 10;

// Simple in-memory rate limiter: max 10 login attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkLoginRateLimit(ip: string): void {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + window });
    return;
  }
  entry.count++;
  if (entry.count > 10) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Please try again later." });
  }
}

export const authEmailRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.password !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Passwords do not match",
        });
      }

      const pool = await getRawDb();
      const conn = await pool.getConnection();

      try {
        // Check if email already exists
        const [existingUsers] = await conn.execute(
          "SELECT id FROM users WHERE email = ? AND login_method = 'email'",
          [input.email]
        );

        if ((existingUsers as any[]).length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already registered",
          });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

        // Generate unique openId for email users
        const openId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create user with PENDING status
        await conn.execute(
          `INSERT INTO users (open_id, email, password_hash, login_method, name, status, role, created_at, updated_at, last_signed_in)
           VALUES (?, ?, ?, 'email', ?, 'pending', 'user', NOW(), NOW(), NOW())`,
          [openId, input.email, passwordHash, input.name || input.email]
        );

        return {
          success: true,
          message: "Account created successfully. Awaiting admin activation.",
        };
      } catch (error: any) {
        if (error.code === "CONFLICT") throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account",
        });
      } finally {
        conn.release();
      }
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ip = (ctx.req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || ctx.req.socket?.remoteAddress || 'unknown';
      checkLoginRateLimit(ip);

      const pool = await getRawDb();
      const conn = await pool.getConnection();

      try {
        // Find user by email
        const [users] = await conn.execute(
          `SELECT id, password_hash, status, role, name, open_id FROM users 
           WHERE email = ? AND login_method = 'email'`,
          [input.email]
        );

        const userList = users as any[];
        if (userList.length === 0) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        const user = userList[0];

        // Verify password
        const passwordValid = await bcrypt.compare(
          input.password,
          user.password_hash
        );

        if (!passwordValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Check user status
        if (user.status === "pending") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Account pending admin activation. Please wait for approval.",
          });
        }

        if (user.status === "suspended") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Account suspended. Please contact support.",
          });
        }

        // Update last signed in
        await conn.execute(
          "UPDATE users SET last_signed_in = NOW() WHERE id = ?",
          [user.id]
        );

        // Create JWT session token — use same maxAge/expiry as OAuth login
        const sessionToken = await sdk.createSessionToken(user.open_id, {
          name: user.name,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          message: "Login successful",
          user: {
            id: user.id,
            email: input.email,
            name: user.name,
            role: user.role,
          },
        };
      } catch (error: any) {
        if (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN") throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Login failed",
        });
      } finally {
        conn.release();
      }
    }),
});
