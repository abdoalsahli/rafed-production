import { getDb } from "../db";
import { products, serviceProviders } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Product Code Service (Phase 13)
 * 
 * Manages stable external identifiers for products
 * Enables code-first API while maintaining backward compatibility with numeric IDs
 * 
 * Format: PROVIDER_CODE_PRODUCT_CODE (e.g., ZAIN_STEAM_10)
 * - Globally stable
 * - Human-readable
 * - Immutable once published
 * - Unique within provider
 */

export class ProductCodeService {
  /**
   * Lookup product by code (code-first approach)
   * 
   * Supports both:
   * - Full code: "ZAIN_STEAM_10"
   * - Provider + product code: providerCode="ZAIN", productCode="STEAM_10"
   */
  static async lookupByCode(
    providerCode: string,
    productCode: string
  ): Promise<{
    productId: number;
    providerId: number;
    productCode: string;
    providerCode: string;
  } | null> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    // Find provider by code
    const providers = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.providerCode, providerCode))
      .limit(1);

    if (providers.length === 0) {
      return null;
    }

    const provider = providers[0];

    // Find product by provider ID and product code
    const prods = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.providerId, provider.id),
          eq(products.productCode, productCode)
        )
      )
      .limit(1);

    if (prods.length === 0) {
      return null;
    }

    const product = prods[0];

    return {
      productId: product.id,
      providerId: provider.id,
      productCode: product.productCode || "",
      providerCode: provider.providerCode,
    };
  }

  /**
   * Lookup product by numeric ID (backward compatibility)
   * Returns the product with its provider code
   */
  static async lookupById(
    providerId: number,
    productId: number
  ): Promise<{
    productId: number;
    providerId: number;
    productCode: string | null;
    providerCode: string;
  } | null> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    // Find provider
    const providers = await db
      .select()
      .from(serviceProviders)
      .where(eq(serviceProviders.id, providerId))
      .limit(1);

    if (providers.length === 0) {
      return null;
    }

    const provider = providers[0];

    // Find product
    const prods = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.providerId, providerId),
          eq(products.id, productId)
        )
      )
      .limit(1);

    if (prods.length === 0) {
      return null;
    }

    const product = prods[0];

    return {
      productId: product.id,
      providerId: provider.id,
      productCode: product.productCode || null,
      providerCode: provider.providerCode,
    };
  }

  /**
   * Assign product code to a product
   * 
   * Requirements:
   * - Must be unique within provider
   * - Immutable once published (cannot be changed)
   * - Human-readable format
   */
  static async assignProductCode(
    providerId: number,
    productId: number,
    productCode: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    // Validate product code format (alphanumeric + underscore, 1-64 chars)
    if (!/^[A-Z0-9_]{1,64}$/.test(productCode)) {
      throw new Error(
        "Invalid product code format. Must be uppercase alphanumeric with underscores, 1-64 characters"
      );
    }

    // Get product to check if code is already assigned
    const prods = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.providerId, providerId),
          eq(products.id, productId)
        )
      )
      .limit(1);

    if (prods.length === 0) {
      throw new Error("Product not found");
    }

    const product = prods[0];

    // Check if product code is already assigned (immutability)
    if (product.productCode && product.productCode !== productCode) {
      throw new Error(
        `Product code is immutable. Current code: ${product.productCode}`
      );
    }

    // Check if code is already used by another product in this provider
    if (product.productCode !== productCode) {
      const existing = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.providerId, providerId),
            eq(products.productCode, productCode)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error(
          `Product code "${productCode}" is already assigned to another product in this provider`
        );
      }
    }

    // Assign or update product code
    await db
      .update(products)
      .set({ productCode })
      .where(
        and(
          eq(products.providerId, providerId),
          eq(products.id, productId)
        )
      );
  }

  /**
   * Get all product codes for a provider
   * Useful for API documentation and provider management
   */
  static async getProviderProductCodes(
    providerId: number
  ): Promise<
    Array<{
      productId: number;
      productCode: string | null;
      name: string;
      displayName: string | null;
      price: string;
    }>
  > {
    const db = await getDb();
    if (!db) throw new Error("Database connection not available");

    const prods = await db
      .select({
        id: products.id,
        productCode: products.productCode,
        name: products.name,
        displayName: products.displayName,
        price: products.price,
      })
      .from(products)
      .where(eq(products.providerId, providerId));

    return prods.map((p) => ({
      productId: p.id,
      productCode: p.productCode,
      name: p.name,
      displayName: p.displayName || "",
      price: p.price?.toString() || "0",
    }));
  }

  /**
   * Validate that both numeric and code-based lookups return same product
   * Used for backward compatibility testing
   */
  static async validateBackwardCompatibility(
    providerId: number,
    productId: number
  ): Promise<{
    isCompatible: boolean;
    numericLookup: any;
    codeLookup: any;
  }> {
    const numericResult = await this.lookupById(providerId, productId);

    if (!numericResult || !numericResult.productCode) {
      return {
        isCompatible: false,
        numericLookup: numericResult,
        codeLookup: null,
      };
    }

    const codeResult = await this.lookupByCode(
      numericResult.providerCode,
      numericResult.productCode
    );

    const isCompatible: boolean =
      !!codeResult &&
      codeResult.productId === productId &&
      codeResult.providerId === providerId;

    return {
      isCompatible,
      numericLookup: numericResult,
      codeLookup: codeResult,
    };
  }
}
