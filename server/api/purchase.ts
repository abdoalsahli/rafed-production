import { z } from "zod";
import { getDb } from "../db";
import { queueManager } from "../queue-manager";
import { purchaseRequests, products, providerDistributorRelationships } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { revealPinOnce } from "../services/pin-reveal.service";

/**
 * Request body validation schema
 */
const purchaseRequestSchema = z.object({
  providerId: z.number().int().positive().optional(),
  productId: z.number().int().positive(),
});

type PurchaseRequest = z.infer<typeof purchaseRequestSchema>;

/**
 * Handle external purchase API request
 * 
 * Supports optional wait=true query parameter for fast-path completion:
 * - wait=true: Wait up to 5 seconds for purchase to complete
 * - wait=false or omitted: Return immediately with PENDING status
 */
export async function handleExternalPurchase(
  req: any,
  res: any
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
    
    // Parse wait parameter (max 5 seconds)
    const waitParam = (req.query?.wait as string)?.toLowerCase() === 'true';
    const maxWaitMs = 5000; // 5 seconds

    // Validate idempotency key
    const idempotencyKey = req.headers["idempotency-key"] as string;
    if (!idempotencyKey) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_IDEMPOTENCY_KEY",
          message: "Idempotency-Key header is required",
        },
      });
      return;
    }

    // Validate request body
    let body: PurchaseRequest;
    try {
      body = purchaseRequestSchema.parse(req.body);
    } catch (validationError) {
      const error = validationError as z.ZodError<any>;
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid request body",
          details: error.issues?.map((e: any) => ({
            field: e.path?.join(".") || "unknown",
            message: e.message,
          })) || [],
        },
      });
      return;
    }

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

    // If providerId not provided, resolve it from productId
    let providerId = body.providerId;
    if (!providerId) {
      const productList = await db
        .select({ providerId: products.providerId })
        .from(products)
        .where(eq(products.id, body.productId))
        .limit(1);

      if (productList.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: "Product not found",
          },
        });
        return;
      }

      providerId = productList[0].providerId;
    }

    // Verify relationship is active
    const relationship = await db
      .select()
      .from(providerDistributorRelationships)
      .where(
        and(
          eq(providerDistributorRelationships.providerId, providerId),
          eq(providerDistributorRelationships.distributorId, distributorId),
          eq(providerDistributorRelationships.status, "active")
        )
      )
      .limit(1);

    if (relationship.length === 0) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN_PRODUCT",
          message: "Not connected to this provider or connection is inactive",
        },
      });
      return;
    }

    // Verify product belongs to provider and is active
    const product = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, body.productId),
          eq(products.providerId, providerId),
          eq(products.status, "active")
        )
      )
      .limit(1);

    if (product.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found or inactive",
        },
      });
      return;
    }

    // Check for idempotency - scoped to this distributor to prevent cross-tenant leakage (C-1)
    const existingRequests = await db
      .select()
      .from(purchaseRequests)
      .where(
        and(
          eq(purchaseRequests.idempotencyKey, idempotencyKey),
          eq(purchaseRequests.distributorId, distributorId)
        )
      );

    if (existingRequests.length > 0) {
      const existing = existingRequests[0];
      
      // Return the existing result
      res.status(200).json(
        await formatPurchaseResponse(existing, db, distributorId, apiAuth.credentialId)
      );
      return;
    }

    // Enqueue purchase request
    const result = await queueManager.enqueueRequest(
      providerId,
      distributorId,
      body.productId,
      idempotencyKey
    );

    if (result.status === "REJECTED") {
      res.status(409).json({
        success: false,
        error: {
          code: "QUEUE_FULL",
          message: result.error || "Queue at capacity. Please retry later.",
        },
      });
      return;
    }

    // Fetch the created request
    let createdRequest = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, result.requestId));

    if (createdRequest.length === 0) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create purchase request",
        },
      });
      return;
    }

    // If wait=true, poll for completion up to 5 seconds
    if (waitParam) {
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs) {
        const status = createdRequest[0].status;
        
        // If purchase completed, return immediately
        if (status === "SUCCEEDED" || status === "FAILED") {
          res.status(200).json(
            await formatPurchaseResponse(createdRequest[0], db, distributorId, apiAuth.credentialId)
          );
          return;
        }
        
        // Wait 100ms before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Refresh request status
        const refreshed = await db
          .select()
          .from(purchaseRequests)
          .where(eq(purchaseRequests.id, result.requestId));
        
        if (refreshed.length > 0) {
          createdRequest = refreshed;
        }
      }
    }

    // Return response (either completed if wait=true, or PENDING)
    res.status(200).json(
      await formatPurchaseResponse(createdRequest[0], db, distributorId, apiAuth.credentialId)
    );
  } catch (error) {
    console.error("[External Purchase API] Unexpected error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  }
}

/**
 * Format purchase response, decrypting the PIN on first retrieval (one-time).
 */
async function formatPurchaseResponse(
  request: any,
  db: any,
  distributorId: number,
  credentialId: number,
): Promise<any> {
  const productList = await db
    .select()
    .from(products)
    .where(eq(products.id, request.productId));

  const product = productList[0];

  const base = {
    success: true,
    requestId: request.id,
    status: request.status,
    providerId: request.providerId,
    productId: request.productId,
    amount: product?.price?.toString() || "0.00",
    createdAt: request.createdAt,
    completedAt: request.completedAt || null,
    card: null as any,
  };

  if (!request.cardId || request.status !== "SUCCEEDED") {
    return base;
  }

  base.card = await revealPinOnce(
    request.cardId,
    distributorId,
    credentialId,
    request.id,
    "external_api",
  );

  return base;
}
