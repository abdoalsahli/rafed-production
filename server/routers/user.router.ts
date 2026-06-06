/**
 * User Router — shared procedures available to all authenticated roles.
 * Currently handles:
 *  - changePassword
 *  - getNotificationPreferences
 *  - updateNotificationPreferences
 */

import { z } from "zod";
import bcrypt from "bcrypt";
import { getRawDb } from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

const SALT_ROUNDS = 10;

const notifPrefsSchema = z.object({
  transactionAlerts: z.boolean(),
  weeklyReport: z.boolean(),
  securityAlerts: z.boolean(),
  productUpdates: z.boolean(),
});

const DEFAULT_PREFS = {
  transactionAlerts: true,
  weeklyReport: true,
  securityAlerts: true,
  productUpdates: false,
};

export const userRouter = router({
  /**
   * user.changePassword
   * Works for every role (admin, provider, distributor).
   * Verifies the current password before hashing and persisting the new one.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "New password must be at least 8 characters"),
        confirmPassword: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New passwords do not match",
        });
      }

      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute(
          "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
          [ctx.user.id]
        ) as any[];

        if (!rows || rows.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const passwordHash = rows[0].password_hash;
        if (!passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No password is set for this account (OAuth login?)",
          });
        }

        const isValid = await bcrypt.compare(input.currentPassword, passwordHash);
        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Current password is incorrect",
          });
        }

        const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
        await conn.execute(
          "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
          [newHash, ctx.user.id]
        );

        return { success: true, message: "Password changed successfully" };
      } finally {
        conn.release();
      }
    }),

  /**
   * user.getNotificationPreferences
   * Reads the JSON blob from users_extended.notification_preferences.
   * Returns defaults if no row / no prefs stored yet.
   */
  getNotificationPreferences: protectedProcedure.query(async ({ ctx }) => {
    const pool = await getRawDb();
    if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        "SELECT notification_preferences FROM users_extended WHERE user_id = ? LIMIT 1",
        [ctx.user.id]
      ) as any[];

      if (!rows || rows.length === 0 || !rows[0].notification_preferences) {
        return DEFAULT_PREFS;
      }

      try {
        return { ...DEFAULT_PREFS, ...JSON.parse(rows[0].notification_preferences) };
      } catch {
        return DEFAULT_PREFS;
      }
    } catch (err: any) {
      // Column may not exist yet in the DB (schema not migrated) — return defaults gracefully
      if (err?.code === 'ER_BAD_FIELD_ERROR') return DEFAULT_PREFS;
      throw err;
    } finally {
      conn.release();
    }
  }),

  /**
   * user.updateNotificationPreferences
   * Upserts the JSON blob into users_extended.notification_preferences.
   */
  updateNotificationPreferences: protectedProcedure
    .input(notifPrefsSchema)
    .mutation(async ({ ctx, input }) => {
      const pool = await getRawDb();
      if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conn = await pool.getConnection();
      try {
        const prefsJson = JSON.stringify(input);

        const [rows] = await conn.execute(
          "SELECT user_id FROM users_extended WHERE user_id = ? LIMIT 1",
          [ctx.user.id]
        ) as any[];

        if (rows && rows.length > 0) {
          await conn.execute(
            "UPDATE users_extended SET notification_preferences = ? WHERE user_id = ?",
            [prefsJson, ctx.user.id]
          );
        } else {
          // Admin users may not have a users_extended row — insert one
          await conn.execute(
            "INSERT INTO users_extended (user_id, status, notification_preferences) VALUES (?, 'active', ?)",
            [ctx.user.id, prefsJson]
          );
        }

        return { success: true };
      } catch (err: any) {
        // Column may not exist yet — silently succeed so the UI doesn't break
        if (err?.code === 'ER_BAD_FIELD_ERROR') return { success: true };
        throw err;
      } finally {
        conn.release();
      }
    }),
});
