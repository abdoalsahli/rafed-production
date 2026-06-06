/**
 * Purchase Validation Service
 * Validates product availability and distributor-provider relationships
 * before purchase execution
 */

import { getDb } from "../db";
import {
  products,
  providerDistributorRelationships,
  cards,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export interface ProductValidation {
  productId: number;
  providerId: number;
  isValid: boolean;
  errors: string[];
  product?: {
    id: number;
    providerId: number;
    name: string;
    displayName: string | null;
    price: string | number;
    isActive: number;
    status: string;
  };
  availableStock?: number;
}

export interface PurchaseValidationRequest {
  distributorId: number;
  productId: number;
}

/**
 * Validates that a product exists and is active
 */
export async function validateProductExists(
  productId: number
): Promise<ProductValidation> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (product.length === 0) {
    return {
      productId,
      providerId: 0,
      isValid: false,
      errors: ["Product not found"],
    };
  }

  return {
    productId,
    providerId: product[0].providerId,
    isValid: true,
    errors: [],
    product: product[0],
  };
}

/**
 * Validates that a product is active
 */
export async function validateProductActive(
  productId: number
): Promise<ProductValidation> {
  const validation = await validateProductExists(productId);
  if (!validation.isValid) {
    return validation;
  }

  const product = validation.product!;
  const errors: string[] = [];

  if (product.status !== "active") {
    errors.push(`Product is not active (status: ${product.status})`);
  }

  if (product.isActive !== 1) {
    errors.push("Product is disabled");
  }

  return {
    productId,
    providerId: product.providerId,
    isValid: errors.length === 0,
    errors,
    product,
  };
}

/**
 * Validates that stock is available for a product
 */
export async function validateProductStock(
  productId: number
): Promise<ProductValidation> {
  const validation = await validateProductActive(productId);
  if (!validation.isValid) {
    return validation;
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  const stockResult = await db
    .select()
    .from(cards)
    .where(
      and(
        eq(cards.productId, productId),
        eq(cards.status, "AVAILABLE")
      )
    )
    .limit(1);

  const availableStock = stockResult.length > 0 ? 1 : 0;
  const errors = validation.errors.slice();

  if (availableStock === 0) {
    errors.push("No stock available for this product");
  }

  return {
    productId,
    providerId: validation.product!.providerId,
    isValid: errors.length === 0,
    errors,
    product: validation.product,
    availableStock,
  };
}

/**
 * Validates that distributor-provider relationship is active
 */
export async function validateDistributorProviderRelationship(
  distributorId: number,
  providerId: number
): Promise<{ isValid: boolean; errors: string[] }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  const relationship = await db
    .select()
    .from(providerDistributorRelationships)
    .where(
      and(
        eq(providerDistributorRelationships.distributorId, distributorId),
        eq(providerDistributorRelationships.providerId, providerId)
      )
    )
    .limit(1);

  const errors: string[] = [];

  if (relationship.length === 0) {
    errors.push("No relationship between distributor and provider");
    return { isValid: false, errors };
  }

  const rel = relationship[0];

  if (rel.status !== "active") {
    errors.push(`Relationship is not active (status: ${rel.status})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Full purchase validation
 * Checks:
 * 1. Product exists
 * 2. Product is active
 * 3. Stock is available
 * 4. Distributor-provider relationship is active
 */
export async function validatePurchase(
  request: PurchaseValidationRequest
): Promise<{
  isValid: boolean;
  errors: string[];
  productValidation?: ProductValidation;
  relationshipValidation?: { isValid: boolean; errors: string[] };
}> {
  try {
    // Step 1: Validate product
    const productValidation = await validateProductStock(request.productId);
    if (!productValidation.isValid) {
      return {
        isValid: false,
        errors: productValidation.errors,
        productValidation,
      };
    }

    // Step 2: Validate distributor-provider relationship
    const relationshipValidation = await validateDistributorProviderRelationship(
      request.distributorId,
      productValidation.providerId
    );

    if (!relationshipValidation.isValid) {
      return {
        isValid: false,
        errors: relationshipValidation.errors,
        productValidation,
        relationshipValidation,
      };
    }

    return {
      isValid: true,
      errors: [],
      productValidation,
      relationshipValidation,
    };
  } catch (error) {
    console.error("[Purchase Validation] Error during validation:", error);
    return {
      isValid: false,
      errors: [
        error instanceof Error
          ? error.message
          : "Unknown validation error",
      ],
    };
  }
}

/**
 * Throws TRPC error if validation fails
 */
export async function enforceValidPurchase(
  request: PurchaseValidationRequest
): Promise<void> {
  const validation = await validatePurchase(request);

  if (!validation.isValid) {
    const errorMessage = validation.errors.join("; ");

    // Determine appropriate error code based on error type
    let errorCode: "BAD_REQUEST" | "NOT_FOUND" | "FORBIDDEN" | "PRECONDITION_FAILED" =
      "BAD_REQUEST";

    if (
      validation.errors.some((e) =>
        e.toLowerCase().includes("not found")
      )
    ) {
      errorCode = "NOT_FOUND";
    } else if (
      validation.errors.some((e) =>
        e.toLowerCase().includes("no stock") ||
        e.toLowerCase().includes("unavailable")
      )
    ) {
      errorCode = "PRECONDITION_FAILED";
    } else if (
      validation.errors.some((e) =>
        e.toLowerCase().includes("relationship") ||
        e.toLowerCase().includes("access")
      )
    ) {
      errorCode = "FORBIDDEN";
    }

    throw new TRPCError({
      code: errorCode,
      message: errorMessage,
    });
  }
}
