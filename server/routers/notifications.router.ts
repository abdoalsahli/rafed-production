import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { NotificationService } from "../_core/notification.service";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

export const notificationsRouter = router({
  /**
   * Get all notifications for the current user
   */
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const notifications = await NotificationService.getNotifications(
          ctx.user.id,
          input?.limit || 50
        );
        return notifications;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch notifications",
        });
      }
    }),

  /**
   * Get unread notification count
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    try {
      const count = await NotificationService.getUnreadCount(ctx.user.id);
      return { count };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch unread count",
      });
    }
  }),

  /**
   * Mark a notification as read
   */
  markAsRead: protectedProcedure
    .input(
      z.object({
        notificationId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        // Verify the notification belongs to the requesting user
        const rows = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(and(eq(notifications.id, input.notificationId), eq(notifications.userId, ctx.user.id)))
          .limit(1);
        if (rows.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
        }
        await NotificationService.markAsRead(input.notificationId);
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark notification as read",
        });
      }
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await NotificationService.markAllAsRead(ctx.user.id);
      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to mark all notifications as read",
      });
    }
  }),
});
