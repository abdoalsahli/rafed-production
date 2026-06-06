/**
 * Provider Product Management Endpoints
 * Implements product creation, updates, and listing for providers
 */

import { z } from "zod";
import { getDb, getRawDb } from "../db";
import { products, serviceProviders, cards } from "../../drizzle/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { router } from "../_core/trpc";

// Helper: Get provider ID from user's organizations
async function getProviderIdFromUser(userId: number, db: any): Promise<number> {
  const legacyProvider = await db
    .select({ id: serviceProviders.id })
    .from(serviceProviders)
    .where(eq(serviceProviders.id, userId))
    .limit(1);
  
  if (legacyProvider.length > 0) {
    return legacyProvider[0].id;
  }
  
  const pool = await getRawDb();
  if (!pool) throw new Error("Database connection not available");
  
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT DISTINCT sp.id FROM service_providers sp
       INNER JOIN organizations o ON sp.organization_id = o.id
       INNER JOIN organization_users ou ON o.id = ou.organization_id
       WHERE ou.user_id = ? AND o.type = 'provider'
       LIMIT 1`,
      [userId]
    );
    
    if (rows && rows.length > 0) {
      return rows[0].id;
    }
    
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User is not linked to any provider organization",
    });
  } finally {
    conn.release();
  }
}

export const providerProductsRouter = router({
  /**
   * provider.createProduct
   * Creates a new product for the authenticated provider
   */
  createProduct: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        displayName: z.string().max(255).optional(),
        description: z.string().optional(),
        faceValue: z.number().positive().optional(),
        currency: z.string().length(3).default("LYD"),
        price: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id, db);

      try {
        // Verify provider exists
        const provider = await db
          .select()
          .from(serviceProviders)
          .where(eq(serviceProviders.id, providerId))
          .limit(1);

        if (provider.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Provider not found",
          });
        }

        // Create product
        const result = await db.insert(products).values({
          providerId,
          name: input.name,
          displayName: input.displayName || input.name,
          description: input.description,
          faceValue: input.faceValue ? parseFloat(input.faceValue.toString()) : null,
          currency: input.currency,
          price: parseFloat(input.price.toString()),
          status: "active",
          isActive: 1,
        } as any);

        // Get the created product
        const newProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, (result as any).insertId))
          .limit(1);

        if (newProduct.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve created product",
          });
        }

        return {
          success: true,
          product: newProduct[0],
        };
      } catch (error) {
        console.error("[Provider Router] Error creating product:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create product",
        });
      }
    }),

  /**
   * provider.updateProduct
   * Updates an existing product
   */
  updateProduct: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        displayName: z.string().max(255).optional(),
        description: z.string().optional(),
        faceValue: z.number().positive().optional(),
        currency: z.string().length(3).optional(),
        price: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id, db);

      try {
        // Verify product belongs to this provider
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, providerId)
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or does not belong to this provider",
          });
        }

        // Build update object with only provided fields
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.name !== undefined) updateData.name = input.name;
        if (input.displayName !== undefined) updateData.displayName = input.displayName;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.faceValue !== undefined) updateData.faceValue = input.faceValue;
        if (input.currency !== undefined) updateData.currency = input.currency;
        if (input.price !== undefined) updateData.price = input.price;

        // Update product
        await db
          .update(products)
          .set(updateData)
          .where(eq(products.id, input.productId));

        // Get updated product
        const updatedProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        return {
          success: true,
          product: updatedProduct[0],
        };
      } catch (error) {
        console.error("[Provider Router] Error updating product:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update product",
        });
      }
    }),

  /**
   * provider.listProducts
   * Lists all products for the authenticated provider
   */
  listProducts: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
        status: z.enum(["active", "inactive"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id, db);
      try {
        // Build where conditions
        const whereConditions = [eq(products.providerId, providerId)];
        if (input.status) {
          whereConditions.push(eq(products.status, input.status));
        }
        
        // Try to fetch products - if none exist, return empty list
        // This handles cases where provider record doesn't exist yet
        try {
          const result = await db
            .select()
            .from(products)
            .where(and(...whereConditions))
            .orderBy(desc(products.createdAt))
            .limit(input.limit)
            .offset(input.offset);

          // Fetch stock counts for each product
          const productsWithStock = await Promise.all(
            result.map(async (product: any) => {
              const stockResult = await db
                .select({ count: count() })
                .from(cards)
                .where(
                  and(
                    eq(cards.productId, product.id),
                    eq(cards.providerId, providerId),
                    eq(cards.status, "AVAILABLE")
                  )
                );
              
              const availableStock = Number(stockResult[0]?.count || 0);
              
              // Determine stock status
              let stockStatus = "IN_STOCK";
              if (availableStock === 0) {
                stockStatus = "OUT_OF_STOCK";
              } else if (availableStock < 10) {
                stockStatus = "LOW_STOCK";
              }
              
              return {
                ...product,
                availableStock,
                stockStatus,
                lowStockThreshold: 10,
              };
            })
          );

          return {
            products: productsWithStock,
            total: result.length,
          };
        } catch (dbError) {
          // If query fails due to missing provider, return empty list
          console.log("[Provider Products] No products found for provider:", providerId);
          return {
            products: [],
            total: 0,
          };
        }
      } catch (error) {
        console.error("[Provider Router] Error listing products:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list products",
        });
      }
    }),

  /**
   * provider.getProductDetails
   * Gets detailed information about a specific product
   */
  getProductDetails: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id, db);

      try {
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, providerId)
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found",
          });
        }

        return {
          product: product[0],
        };
      } catch (error) {
        console.error("[Provider Router] Error getting product details:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get product details",
        });
      }
    }),

  /**
   * provider.setProductStatus
   * Activates or deactivates a product
   */
  setProductStatus: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const providerId = await getProviderIdFromUser(ctx.user.id, db);

      try {
        // Verify product belongs to this provider
        const product = await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.id, input.productId),
              eq(products.providerId, providerId)
            )
          )
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found or does not belong to this provider",
          });
        }

        // Update status
        await db
          .update(products)
          .set({
            status: input.isActive ? "active" : "inactive",
            isActive: input.isActive ? 1 : 0,
            updatedAt: new Date(),
          })
          .where(eq(products.id, input.productId));

        // Get updated product
        const updatedProduct = await db
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .limit(1);

        return {
          success: true,
          product: updatedProduct[0],
        };
      } catch (error) {
        console.error("[Provider Router] Error setting product status:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to set product status",
        });
      }
    }),
});
