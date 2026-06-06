import { Request, Response } from "express";
import { getDb } from "../db";
import {
  products,
  serviceProviders,
  providerDistributorRelationships,
} from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Get product catalog for authenticated distributor
 * Returns only products from providers the distributor has active relationships with
 */
export async function handleProductCatalog(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Get API auth context (set by middleware)
    const apiAuth = (req as any).apiAuth;
    if (!apiAuth) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API authentication required",
        },
      });
      return;
    }

    const distributorId = apiAuth.distributorId;

    const db = await getDb();
    if (!db) {
      res.status(500).json({
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "Database connection unavailable",
        },
      });
      return;
    }

    // Get all active provider-distributor relationships for this distributor
    const relationships = await db
      .select({
        providerId: providerDistributorRelationships.providerId,
      })
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.distributorId, distributorId),
          eq(providerDistributorRelationships.status, "active")
        )
      );

    const providerIds = relationships.map((r) => r.providerId);

    if (providerIds.length === 0) {
      res.status(200).json({
        success: true,
        products: [],
      });
      return;
    }

    // Get all active products from connected providers
    const productList = await db
      .select({
        productId: products.id,
        productName: products.name,
        price: products.price,
        providerId: products.providerId,
        providerName: serviceProviders.name,
        providerCode: serviceProviders.providerCode,
      })
      .from(products)
      .innerJoin(serviceProviders, eq(products.providerId, serviceProviders.id))
      .where(
        and(
          eq(products.status, "active"),
          eq(serviceProviders.status, "active"),
          inArray(products.providerId, providerIds)
        )
      );

    // Format response - expose only safe fields
    const catalogProducts = productList.map((p) => ({
      providerId: p.providerId,
      providerName: p.providerName || "",
      providerCode: p.providerCode || "",
      productId: p.productId,
      productName: p.productName || "",
      price: String(p.price || "0.00"),
    }));

    res.status(200).json({
      success: true,
      products: catalogProducts,
    });
  } catch (error) {
    console.error("[Product Catalog API] Unexpected error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  }
}
