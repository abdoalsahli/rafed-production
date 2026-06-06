/**
 * Distributor Product Catalog Endpoint
 * Provides access to all active products from approved providers
 */

import { z } from "zod";
import { getDb } from "../db";
import {
  products,
  serviceProviders,
  providerDistributorRelationships,
  cards,
} from "../../drizzle/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import { router } from "../_core/trpc";
import { getDistributorIdFromUser } from "../utils/org-lookup";

export const distributorCatalogRouter = router({
  /**
   * distributor.listAvailableProducts
   * Returns all active products from providers that the distributor is approved under
   *
   * Rules:
   * - Only include products from providers with approved relationships
   * - Only include active products (status = "active")
   * - Include provider info for display
   * - Include stock availability indicator
   */
  listAvailableProducts: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection not available");
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        // Get all active provider-distributor relationships for this distributor
        const relationships = await db
          .select({
            providerId: providerDistributorRelationships.providerId,
            status: providerDistributorRelationships.status,
          })
          .from(providerDistributorRelationships)
          .where(
            and(
              eq(providerDistributorRelationships.distributorId, distributorId),
              eq(providerDistributorRelationships.status, "active")
            )
          );

        if (relationships.length === 0) {
          return {
            products: [],
            total: 0,
          };
        }

        const approvedProviderIds = relationships.map((r) => r.providerId);

        // Get all active products from approved providers
        const productList = await db
          .select({
            id: products.id,
            providerId: products.providerId,
            name: products.name,
            displayName: products.displayName,
            description: products.description,
            faceValue: products.faceValue,
            currency: products.currency,
            price: products.price,
            status: products.status,
            isActive: products.isActive,
            createdAt: products.createdAt,
            providerName: serviceProviders.name,
          })
          .from(products)
          .innerJoin(
            serviceProviders,
            eq(products.providerId, serviceProviders.id)
          )
          .where(
            and(
              eq(products.status, "active"),
              eq(products.isActive, 1)
            )
          )
          .orderBy(desc(products.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        // Filter to only approved providers
        const filteredProducts = productList.filter((p) =>
          approvedProviderIds.includes(p.providerId)
        );

        // Add stock availability for each product
        const productsWithStock = await Promise.all(
          filteredProducts.map(async (product) => {
            // Count available cards for this product
            const stockResult = await db
              .select({ count: count() })
              .from(cards)
              .where(
                and(
                  eq(cards.productId, product.id),
                  eq(cards.status, "AVAILABLE")
                )
              );

            const inStock = (stockResult[0]?.count || 0) > 0;

            return {
              productId: product.id,
              providerId: product.providerId,
              providerName: product.providerName,
              displayName: product.displayName || product.name,
              description: product.description,
              faceValue: product.faceValue,
              currency: product.currency,
              price: product.price,
              isActive: product.isActive === 1,
              isAvailable: inStock,
              stockStatus: inStock ? "available" : "unavailable",
            };
          })
        );

        return {
          products: productsWithStock,
          total: productsWithStock.length,
        };
      } catch (error) {
        console.error("[Distributor Catalog] Error listing available products:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list available products",
        });
      }
    }),

  /**
   * distributor.getProductDetails
   * Returns detailed information about a specific product
   * Verifies the distributor has access to the product's provider
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
      const distributorId = await getDistributorIdFromUser(ctx.user.id);

      try {
        // Get the product
        const product = await db
          .select({
            id: products.id,
            providerId: products.providerId,
            name: products.name,
            displayName: products.displayName,
            description: products.description,
            faceValue: products.faceValue,
            currency: products.currency,
            price: products.price,
            status: products.status,
            isActive: products.isActive,
            createdAt: products.createdAt,
            providerName: serviceProviders.name,
          })
          .from(products)
          .innerJoin(
            serviceProviders,
            eq(products.providerId, serviceProviders.id)
          )
          .where(eq(products.id, input.productId))
          .limit(1);

        if (product.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found",
          });
        }

        const p = product[0];

        // Verify distributor has access to this provider
        const relationship = await db
          .select()
          .from(providerDistributorRelationships)
          .where(
            and(
              eq(providerDistributorRelationships.distributorId, distributorId),
              eq(providerDistributorRelationships.providerId, p.providerId),
              eq(providerDistributorRelationships.status, "active")
            )
          )
          .limit(1);

        if (relationship.length === 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this product",
          });
        }

        // Get stock info
        const stockResult = await db
          .select({ count: count() })
          .from(cards)
          .where(
            and(
              eq(cards.productId, p.id),
              eq(cards.status, "AVAILABLE")
            )
          );

        const availableStock = stockResult[0]?.count || 0;

        return {
          product: {
            productId: p.id,
            providerId: p.providerId,
            providerName: p.providerName,
            displayName: p.displayName || p.name,
            description: p.description,
            faceValue: p.faceValue,
            currency: p.currency,
            price: p.price,
            isActive: p.isActive === 1,
            isAvailable: availableStock > 0,
            stockStatus: availableStock > 0 ? "available" : "unavailable",
            availableStock: availableStock,
            createdAt: p.createdAt,
          },
        };
      } catch (error) {
        console.error("[Distributor Catalog] Error getting product details:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get product details",
        });
      }
    }),
});
