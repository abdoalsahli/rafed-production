import { Request, Response } from "express";
import { getDb } from "../db";
import { purchaseRequests, products } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { revealPinOnce } from "../services/pin-reveal.service";

/**
 * Get purchase request status
 * Authenticated distributor can only fetch their own purchase requests
 */
export async function handlePurchaseStatus(
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
    const requestId = parseInt(req.params.requestId, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST_ID",
          message: "Invalid request ID format",
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

    // Fetch the purchase request
    const requests = await db
      .select()
      .from(purchaseRequests)
      .where(
        and(
          eq(purchaseRequests.id, requestId),
          eq(purchaseRequests.distributorId, distributorId)
        )
      );

    if (requests.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: "REQUEST_NOT_FOUND",
          message: "Purchase request not found or access denied",
        },
      });
      return;
    }

    const request = requests[0];

    // Get product details for response
    const productList = await db
      .select()
      .from(products)
      .where(eq(products.id, request.productId));

    const product = productList[0];

    // Format response based on status
    const response: any = {
      success: true,
      requestId: request.id,
      status: request.status,
      productId: request.productId,
      amount: product?.price?.toString() || "0.00",
      createdAt: request.createdAt,
      completedAt: request.completedAt || null,
    };

    // Only include card details if purchase succeeded — one-time PIN reveal
    if (request.status === "SUCCEEDED" && request.cardId) {
      const credentialId = (req as any).apiAuth?.credentialId ?? 0;
      response.card = await revealPinOnce(
        request.cardId,
        distributorId,
        credentialId,
        requestId,
        "external_api_status",
      );
    }

    // Include failure reason if purchase failed
    if (request.status === "FAILED" && request.failureReason) {
      response.failureReason = request.failureReason;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("[Purchase Status API] Unexpected error:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  }
}
