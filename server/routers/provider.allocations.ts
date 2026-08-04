import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getRawDb } from "../db";
import { getProviderIdFromUser } from "../utils/org-lookup";
import {
  allocationOrders,
  allocationOrderItems,
  allocationOrderCards,
  cards,
  products,
} from "../../drizzle/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { pinEncryptionService } from "../services/encryption.service";
import * as XLSX from "xlsx";

// Authorization is enforced by getProviderIdFromUser — it throws NOT_FOUND
// if the authenticated user has no linked service_provider record.
const providerProcedure = protectedProcedure;

export const providerAllocationsRouter = router({
  /** List all orders for this provider */
  listOrders: providerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const providerId = await getProviderIdFromUser(ctx.user.id);

    const orders = await db
      .select()
      .from(allocationOrders)
      .where(eq(allocationOrders.providerId, providerId))
      .orderBy(sql`${allocationOrders.createdAt} DESC`);

    // Attach item counts
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return [];

    const items = await db
      .select({
        orderId: allocationOrderItems.orderId,
        totalRequested: sql<number>`SUM(${allocationOrderItems.quantityRequested})`,
        totalFulfilled: sql<number>`SUM(${allocationOrderItems.quantityFulfilled})`,
        lineCount: sql<number>`COUNT(*)`,
      })
      .from(allocationOrderItems)
      .where(inArray(allocationOrderItems.orderId, orderIds))
      .groupBy(allocationOrderItems.orderId);

    const itemMap = new Map(items.map((i) => [i.orderId, i]));

    return orders.map((o) => ({
      ...o,
      totalRequested: itemMap.get(o.id)?.totalRequested ?? 0,
      totalFulfilled: itemMap.get(o.id)?.totalFulfilled ?? 0,
      lineCount: itemMap.get(o.id)?.lineCount ?? 0,
    }));
  }),

  /** Get a single order with its items and available stock info */
  getOrder: providerProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const providerId = await getProviderIdFromUser(ctx.user.id);

      const [order] = await db
        .select()
        .from(allocationOrders)
        .where(and(eq(allocationOrders.id, input.orderId), eq(allocationOrders.providerId, providerId)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      const items = await db
        .select({
          id: allocationOrderItems.id,
          productId: allocationOrderItems.productId,
          productName: products.name,
          productDisplayName: products.displayName,
          faceValue: products.faceValue,
          currency: products.currency,
          quantityRequested: allocationOrderItems.quantityRequested,
          quantityFulfilled: allocationOrderItems.quantityFulfilled,
          availableStock: sql<number>`(
            SELECT COUNT(*) FROM cards c
            WHERE c.provider_id = ${providerId}
              AND c.product_id = ${allocationOrderItems.productId}
              AND c.status = 'AVAILABLE'
          )`,
        })
        .from(allocationOrderItems)
        .leftJoin(products, eq(products.id, allocationOrderItems.productId))
        .where(eq(allocationOrderItems.orderId, order.id));

      const allProducts = await db
        .select({
          id: products.id,
          name: products.name,
          displayName: products.displayName,
          faceValue: products.faceValue,
          currency: products.currency,
          status: products.status,
        })
        .from(products)
        .where(and(eq(products.providerId, providerId), eq(products.status, "active")));

      return { ...order, items, allProducts };
    }),

  /** Create a new draft order */
  createOrder: providerProcedure
    .input(z.object({
      clientName: z.string().min(1).max(255),
      clientPhone: z.string().max(64).optional(),
      clientNotes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const providerId = await getProviderIdFromUser(ctx.user.id);
      const pool = await getRawDb();
      const conn = await pool.getConnection();
      try {
        const [result]: any = await conn.execute(
          `INSERT INTO allocation_orders (provider_id, client_name, client_phone, client_notes, status, created_at)
           VALUES (?, ?, ?, ?, 'draft', NOW())`,
          [providerId, input.clientName, input.clientPhone ?? null, input.clientNotes ?? null]
        );
        return { orderId: result.insertId as number };
      } finally {
        conn.release();
      }
    }),

  /** Add or update a product line in a draft order */
  upsertItem: providerProcedure
    .input(z.object({
      orderId: z.number().int().positive(),
      productId: z.number().int().positive(),
      quantity: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const providerId = await getProviderIdFromUser(ctx.user.id);

      const [order] = await db
        .select()
        .from(allocationOrders)
        .where(and(eq(allocationOrders.id, input.orderId), eq(allocationOrders.providerId, providerId)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft orders can be edited" });

      // Verify product belongs to this provider
      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.providerId, providerId)))
        .limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

      // Upsert the line
      const existing = await db
        .select()
        .from(allocationOrderItems)
        .where(and(eq(allocationOrderItems.orderId, input.orderId), eq(allocationOrderItems.productId, input.productId)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(allocationOrderItems)
          .set({ quantityRequested: input.quantity })
          .where(eq(allocationOrderItems.id, existing[0].id));
      } else {
        await db.insert(allocationOrderItems).values({
          orderId: input.orderId,
          productId: input.productId,
          quantityRequested: input.quantity,
          quantityFulfilled: 0,
        });
      }

      return { success: true };
    }),

  /** Remove a product line from a draft order */
  removeItem: providerProcedure
    .input(z.object({ itemId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const providerId = await getProviderIdFromUser(ctx.user.id);

      // Verify ownership via join
      const [item] = await db
        .select({ id: allocationOrderItems.id, status: allocationOrders.status })
        .from(allocationOrderItems)
        .leftJoin(allocationOrders, eq(allocationOrders.id, allocationOrderItems.orderId))
        .where(and(eq(allocationOrderItems.id, input.itemId), eq(allocationOrders.providerId, providerId)))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      if (item.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft orders can be edited" });

      await db.delete(allocationOrderItems).where(eq(allocationOrderItems.id, input.itemId));
      return { success: true };
    }),

  /** Confirm: lock cards from inventory for each line item */
  confirmOrder: providerProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const providerId = await getProviderIdFromUser(ctx.user.id);
      const pool = await getRawDb();

      const [order] = await db
        .select()
        .from(allocationOrders)
        .where(and(eq(allocationOrders.id, input.orderId), eq(allocationOrders.providerId, providerId)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not in draft status" });

      const items = await db
        .select()
        .from(allocationOrderItems)
        .where(eq(allocationOrderItems.orderId, order.id));

      if (items.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Order has no items" });

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        for (const item of items) {
          // Lock and select available cards
          const [rows]: any = await conn.execute(
            `SELECT id FROM cards
             WHERE provider_id = ? AND product_id = ? AND status = 'AVAILABLE'
             LIMIT ?
             FOR UPDATE`,
            [providerId, item.productId, item.quantityRequested]
          );

          if (rows.length < item.quantityRequested) {
            await conn.rollback();
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `غير كافٍ: طلبت ${item.quantityRequested} ولكن المتاح ${rows.length} فقط للمنتج ${item.productId}`,
            });
          }

          const cardIds: number[] = rows.map((r: any) => r.id);

          // Mark cards as SOLD
          await conn.execute(
            `UPDATE cards SET status = 'SOLD', updated_at = NOW() WHERE id IN (${cardIds.map(() => '?').join(',')})`,
            cardIds
          );

          // Record assignment
          const assignValues = cardIds.map((cid) => [item.id, cid]);
          await conn.execute(
            `INSERT INTO allocation_order_cards (order_item_id, card_id) VALUES ${assignValues.map(() => '(?,?)').join(',')}`,
            assignValues.flat()
          );

          // Update fulfilled count
          await conn.execute(
            `UPDATE allocation_order_items SET quantity_fulfilled = ? WHERE id = ?`,
            [cardIds.length, item.id]
          );
        }

        await conn.execute(
          `UPDATE allocation_orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
          [order.id]
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      return { success: true };
    }),

  /** Mark as delivered */
  markDelivered: providerProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const providerId = await getProviderIdFromUser(ctx.user.id);

      const [order] = await db
        .select()
        .from(allocationOrders)
        .where(and(eq(allocationOrders.id, input.orderId), eq(allocationOrders.providerId, providerId)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status !== "confirmed") throw new TRPCError({ code: "BAD_REQUEST", message: "Order must be confirmed first" });

      await db
        .update(allocationOrders)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(eq(allocationOrders.id, order.id));

      return { success: true };
    }),

  /** Cancel a draft order (releases no cards since none are locked yet) */
  cancelOrder: providerProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const providerId = await getProviderIdFromUser(ctx.user.id);

      const [order] = await db
        .select()
        .from(allocationOrders)
        .where(and(eq(allocationOrders.id, input.orderId), eq(allocationOrders.providerId, providerId)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (!["draft", "confirmed"].includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel a delivered or already cancelled order" });
      }

      const pool = await getRawDb();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        if (order.status === "confirmed") {
          // Release the cards back to AVAILABLE
          const items = await db
            .select({ id: allocationOrderItems.id })
            .from(allocationOrderItems)
            .where(eq(allocationOrderItems.orderId, order.id));

          const itemIds = items.map((i) => i.id);
          if (itemIds.length > 0) {
            const [assigned]: any = await conn.execute(
              `SELECT card_id FROM allocation_order_cards WHERE order_item_id IN (${itemIds.map(() => '?').join(',')})`,
              itemIds
            );
            const cardIds = assigned.map((r: any) => r.card_id);
            if (cardIds.length > 0) {
              await conn.execute(
                `UPDATE cards SET status = 'AVAILABLE', updated_at = NOW() WHERE id IN (${cardIds.map(() => '?').join(',')})`,
                cardIds
              );
            }
          }
        }

        await conn.execute(
          `UPDATE allocation_orders SET status = 'cancelled' WHERE id = ?`,
          [order.id]
        );

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      return { success: true };
    }),

  /** Export order as Excel — returns base64-encoded xlsx */
  exportExcel: providerProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const providerId = await getProviderIdFromUser(ctx.user.id);

      const [order] = await db
        .select()
        .from(allocationOrders)
        .where(and(eq(allocationOrders.id, input.orderId), eq(allocationOrders.providerId, providerId)))
        .limit(1);

      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.status === "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Confirm the order before exporting" });

      const items = await db
        .select({
          itemId: allocationOrderItems.id,
          productName: products.name,
          displayName: products.displayName,
          faceValue: products.faceValue,
          currency: products.currency,
        })
        .from(allocationOrderItems)
        .leftJoin(products, eq(products.id, allocationOrderItems.productId))
        .where(eq(allocationOrderItems.orderId, order.id));

      const pinService = pinEncryptionService;
      const wb = XLSX.utils.book_new();

      const dateStr = order.confirmedAt
        ? new Date(order.confirmedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      // Summary sheet
      const summaryRows = [
        ["العميل", order.clientName],
        ["الهاتف", order.clientPhone ?? "—"],
        ["ملاحظات", order.clientNotes ?? "—"],
        ["تاريخ التخصيص", dateStr],
        ["الحالة", order.status],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, summarySheet, "ملخص الطلب");

      // One sheet per product
      for (const item of items) {
        const assignedCards = await db
          .select({ pinEncrypted: cards.pinEncrypted, serialNumber: cards.serialNumber })
          .from(allocationOrderCards)
          .leftJoin(cards, eq(cards.id, allocationOrderCards.cardId))
          .where(eq(allocationOrderCards.orderItemId, item.itemId));

        const rows: any[][] = [["#", "الرقم التسلسلي", "PIN", "القيمة", "العملة"]];
        let idx = 1;
        for (const c of assignedCards) {
          let pin = "—";
          try {
            if (c.pinEncrypted) pin = await pinService.decryptPIN(c.pinEncrypted);
          } catch {
            pin = "خطأ في فك التشفير";
          }
          rows.push([idx++, c.serialNumber ?? "—", pin, item.faceValue ?? "—", item.currency ?? "—"]);
        }

        const sheet = XLSX.utils.aoa_to_sheet(rows);
        // Cap sheet name at 31 chars (Excel limit)
        const sheetName = (item.displayName || item.productName || `منتج ${item.itemId}`).slice(0, 31);
        XLSX.utils.book_append_sheet(wb, sheet, sheetName);
      }

      const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `تخصيص-${dateStr}.xlsx`;

      return {
        filename,
        base64: buf.toString("base64"),
      };
    }),
});
