import { getDb } from "../db";
import { notifications, InsertNotification } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export type NotificationType = "REQUEST_RECEIVED" | "REQUEST_APPROVED" | "REQUEST_REJECTED";

export interface CreateNotificationInput {
  userId: number;
  type: NotificationType;
  message: string;
  relatedEntityId?: number;
  relatedEntityType?: string;
}

export class NotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification(input: CreateNotificationInput): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const values: any = {
      userId: input.userId,
      type: input.type,
      message: input.message,
      isRead: 0,
      createdAt: new Date(),
    };

    if (input.relatedEntityId !== undefined) {
      values.relatedEntityId = input.relatedEntityId;
    }
    if (input.relatedEntityType !== undefined) {
      values.relatedEntityType = input.relatedEntityType;
    }

    await db.insert(notifications).values(values);
  }

  /**
   * Get all notifications for a user
   */
  static async getNotifications(userId: number, limit: number = 50): Promise<any[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy((t) => t.createdAt)
      .limit(limit);
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: number): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, 0)
        )
      );

    return result.length;
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(notifications)
      .set({ isRead: 1 })
      .where(eq(notifications.id, notificationId));
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(notifications)
      .set({ isRead: 1 })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, 0)
        )
      );
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Note: In production, consider soft deletes instead
    // For now, we'll just leave notifications in the database
  }
}
