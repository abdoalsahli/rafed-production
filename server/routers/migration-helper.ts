/**
 * Migration Helper - Temporary endpoint to apply pending migrations
 * This is for development/testing only
 */

import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

export const migrationHelperRouter = router({
  /**
   * Apply products table migration
   * Adds: display_name, face_value, currency, is_active columns
   * Creates index on status column
   */
  applyProductsMigration: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    try {
      console.log("[Migration] Starting products table migration...");

      // Check if columns already exist
      const result = (await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'products' AND TABLE_SCHEMA = DATABASE()"
      )) as any;

      const existingColumns = (result[0] || []) as Array<{ COLUMN_NAME: string }>;
      const columnNames = existingColumns.map((c) => c.COLUMN_NAME);

      console.log("[Migration] Existing columns:", columnNames);

      const columnsToAdd = [
        {
          name: "display_name",
          sql: "ALTER TABLE `products` ADD COLUMN `display_name` varchar(255) NULL",
        },
        {
          name: "face_value",
          sql: "ALTER TABLE `products` ADD COLUMN `face_value` decimal(10,2) NULL",
        },
        {
          name: "currency",
          sql: "ALTER TABLE `products` ADD COLUMN `currency` varchar(3) DEFAULT 'USD'",
        },
        {
          name: "is_active",
          sql: "ALTER TABLE `products` ADD COLUMN `is_active` int DEFAULT 1 NOT NULL",
        },
      ];

      // Add missing columns
      for (const col of columnsToAdd) {
        if (!columnNames.includes(col.name)) {
          console.log(`[Migration] Adding column: ${col.name}`);
          await db.execute(col.sql);
          console.log(`[Migration] ✓ Added column: ${col.name}`);
        } else {
          console.log(`[Migration] Column already exists: ${col.name}`);
        }
      }

      // Create index on status if it doesn't exist
      const indexResult = (await db.execute(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_status' AND TABLE_SCHEMA = DATABASE()"
      )) as any;

      if (((indexResult[0] as any) || []).length === 0) {
        console.log("[Migration] Creating index on status column");
        await db.execute("CREATE INDEX `idx_products_status` ON `products` (`status`)");
        console.log("[Migration] ✓ Created index on status");
      } else {
        console.log("[Migration] Index already exists");
      }

      console.log("[Migration] ✓ Migration completed successfully");

      return {
        success: true,
        message: "Products table migration applied successfully",
        columnsAdded: columnsToAdd
          .filter((c) => !columnNames.includes(c.name))
          .map((c) => c.name),
      };
    } catch (error) {
      console.error("[Migration] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),
});
