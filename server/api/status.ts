import { Request, Response } from "express";
import { getDb, getRawDb, insertAuditLog } from "../db";
import { purchaseRequests, products } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { pinEncryptionService } from "../services/encryption.service";

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

    // Only include card details if purchase succeeded — decrypt PIN one-time
    if (request.status === "SUCCEEDED" && request.cardId) {
      const pool = await getRawDb();
      const [pinRow]: any = pool
        ? await pool.query("SELECT pin_encrypted, pin_viewed, serial_number FROM cards WHERE id = ?", [request.cardId])
        : [[]];
      const card = pinRow?.[0];

      if (!card) {
        response.card = { serialNumber: null, pin: null };
      } else if (Number(card.pin_viewed) === 1) {
        response.card = { serialNumber: card.serial_number ?? null, pin: null, note: "PIN already retrieved" };
      } else {
        const [markResult]: any = pool
          ? await pool.query("UPDATE cards SET pin_viewed = 1, updated_at = NOW() WHERE id = ? AND pin_viewed = 0", [request.cardId])
          : [{ affectedRows: 0 }];

        if (!markResult?.affectedRows) {
          response.card = { serialNumber: card.serial_number ?? null, pin: null, note: "PIN already retrieved" };
        } else {
          try {
            const pin = await pinEncryptionService.decryptPIN(card.pin_encrypted);
            await insertAuditLog(db, {
              userId: distributorId,
              action: "PIN_VIEWED",
              resourceId: request.cardId,
              metadata: { requestId, distributorId, source: "external_api_status" },
            });
            response.card = { serialNumber: card.serial_number ?? null, pin };
          } catch (err) {
            console.error("[Purchase Status API] PIN decryption failed:", err);
            response.card = { serialNumber: card.serial_number ?? null, pin: null, note: "PIN decryption failed" };
          }
        }
      }
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
