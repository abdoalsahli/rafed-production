import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parseCSV, parseXLSX } from "../utils/file-parser";
import {
  generatePreviewId,
  storePreview,
  getPreview,
  deletePreview,
  validatePreviewOwnership,
  previewCardUploadInputSchema,
  confirmCardUploadInputSchema,
  cancelCardUploadInputSchema,
  UploadPreview,
} from "./upload-preview";

// Re-export schemas for use in router
export { previewCardUploadInputSchema, confirmCardUploadInputSchema, cancelCardUploadInputSchema } from "./upload-preview";

import { getDb, getRawDb } from "../db";
import { pinEncryptionService } from "../services/encryption.service";
import { products, cardBatches, cards, serviceProviders, users, hashPin } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Helper function to get provider ID from user
// Looks up the provider associated with the user's organization
// Users are linked to providers via the service_providers.organization_id field
async function getProviderIdFromUser(userId: number, db: any): Promise<number> {
  // This function needs to be implemented based on how users are linked to providers
  // For now, throw an error to indicate this needs to be fixed
  throw new Error(
    "getProviderIdFromUser is not properly implemented. " +
    "Provider ID must be passed via ctx.user.providerId from the auth middleware. " +
    "User ID: " + userId
  );
}

// Helper function to validate PIN format (4-32 characters)
function validatePin(pin: string): boolean {
  return typeof pin === "string" && pin.length >= 4 && pin.length <= 32;
}

// Note: PIN encryption is now centralized in encryption.service.ts
// This uses AES-256-GCM (not CBC) to match the purchase/decryption flow

/**
 * ENDPOINT 1: previewCardUpload
 * Validates CSV/XLSX file and returns preview summary without creating batch
 */
export async function handlePreviewCardUpload(
  ctx: any,
  input: z.infer<typeof previewCardUploadInputSchema>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection not available");

  if (!ctx.user?.providerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User provider ID not found. Please contact support.",
    });
  }
  const providerId = ctx.user.providerId;

  try {
    // Verify product exists (lenient check for demo/test)
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);

    if (product.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Product not found",
      });
    }

    // Parse file
    let fileBuffer: Buffer;
    if (input.fileBuffer && typeof input.fileBuffer === 'string') {
      // Decode base64 string to Buffer
      fileBuffer = Buffer.from(input.fileBuffer, 'base64');
    } else if (input.fileBuffer && Buffer.isBuffer(input.fileBuffer)) {
      fileBuffer = input.fileBuffer;
    } else {
      fileBuffer = Buffer.alloc(0);
    }

    const parseResult = input.csvContent
      ? parseCSV(input.csvContent)
      : parseXLSX(fileBuffer);

    if (parseResult.cards.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No rows found in file",
      });
    }

    // Get all existing PIN hashes for this provider from the database
    // PIN hashes allow us to detect duplicate uploads
    const rawDb = await getRawDb();
    let existingPinHashes: Set<string> = new Set();
    
    if (rawDb) {
      try {
        const connection = await rawDb.getConnection();
        try {
          // Get all existing PIN hashes for this provider
          const [rows] = await connection.execute(
            `SELECT DISTINCT pin_hash FROM cards WHERE provider_id = ? AND pin_hash IS NOT NULL LIMIT 100000`,
            [providerId]
          );
          if (rows && (rows as any[]).length > 0) {
            (rows as any[]).forEach(row => {
              if (row.pin_hash) {
                existingPinHashes.add(row.pin_hash);
              }
            });
          }
        } finally {
          connection.release();
        }
      } catch (error) {
        console.warn("[Upload] Failed to check existing PIN hashes:", error);
      }
    }

    // Validate all cards
    const validCards: Array<{ card: any; rawPin: string }> = [];
    const invalidCards: Array<{ rowNumber: number; pin: string; error: string }> =
      [];
    const seenPins = new Set<string>();
    const duplicateInSystemCards: Array<{ rowNumber: number; pin: string }> = [];

    for (const card of parseResult.cards) {
      // Check PIN format
      if (!validatePin(card.pin)) {
        invalidCards.push({
          rowNumber: card.rowNumber,
          pin: card.pin,
          error: `Invalid PIN format (must be 4-32 characters)`,
        });
        continue;
      }

      // Check for duplicates within this upload
      if (seenPins.has(card.pin)) {
        invalidCards.push({
          rowNumber: card.rowNumber,
          pin: card.pin,
          error: `Duplicate PIN in this upload`,
        });
        continue;
      }
      seenPins.add(card.pin);

      // Check if PIN already exists in the system for this provider
      // We use SHA256 hash of the raw PIN for duplicate detection
      const pinHash = hashPin(card.pin);
      if (existingPinHashes.has(pinHash)) {
        duplicateInSystemCards.push({
          rowNumber: card.rowNumber,
          pin: card.pin,
        });
        // CRITICAL: Do NOT add to validCards - skip this card
        continue;
      }

      // Check serial number length
      if (card.serialNumber && card.serialNumber.length > 128) {
        invalidCards.push({
          rowNumber: card.rowNumber,
          pin: card.pin,
          error: `Serial number exceeds 128 characters`,
        });
        continue;
      }

      validCards.push({ card, rawPin: card.pin });
    }

    // Generate preview ID and store in cache
    const uploadPreviewId = generatePreviewId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const preview: UploadPreview = {
      uploadPreviewId,
      providerId,
      productId: input.productId,
      fileName: input.fileName,
      validCards,
      invalidCards,
      createdAt: now,
      expiresAt,
    };

    storePreview(preview);

    // Get sample valid rows (first 3) with masked PINs
    const sampleValidRows = validCards.slice(0, 3).map(({ card, rawPin }) => ({
      row: card.rowNumber,
      pinMasked: rawPin.slice(-4).padStart(rawPin.length, "*"),
      serialNumber: card.serialNumber || "N/A",
    }));

    return {
      uploadPreviewId,
      productId: input.productId,
      productName: product[0].name,
      fileName: input.fileName,
      totalRows: parseResult.cards.length,
      validRows: validCards.length,
      invalidRows: invalidCards.length,
      // duplicateRows = in-file duplicates + cards already in DB (both are excluded from import)
      duplicateRows:
        invalidCards.filter((e) => e.error.includes("Duplicate PIN")).length +
        duplicateInSystemCards.length,
      duplicateInSystemCount: duplicateInSystemCards.length,
      duplicateInSystem: duplicateInSystemCards.length > 0 ? duplicateInSystemCards.slice(0, 10) : [],
      errors: invalidCards.slice(0, 10), // First 10 format/validation errors
      sampleValidRows,
      expiresAt,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Preview failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * ENDPOINT 2: confirmCardUpload
 * Approves preview and creates batch with valid cards
 */
export async function handleConfirmCardUpload(
  ctx: any,
  input: z.infer<typeof confirmCardUploadInputSchema>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection not available");

  if (!ctx.user?.providerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User provider ID not found. Please contact support.",
    });
  }
  const providerId = ctx.user.providerId;

  try {
    // Load preview from cache
    const preview = getPreview(input.uploadPreviewId);
    if (!preview) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Preview not found or has expired",
      });
    }

    // Verify user owns preview
    validatePreviewOwnership(preview, providerId);

    // Note: PIN encryption now uses centralized service (encryption.service.ts)
    // No need to load master key here - it's managed by pinEncryptionService

    // Insert batch record using raw SQL to avoid Drizzle ORM issues
    const rawDb = await getRawDb();
    if (!rawDb) {
      throw new Error("Database connection not available");
    }

    const batchConnection = await rawDb.getConnection();
    let batchId: number;
    try {
      const [batchInsertResult] = await batchConnection.execute(
        `INSERT INTO card_batches (provider_id, filename, upload_status, total_cards, processed_cards, failed_cards, uploaded_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [providerId, preview.fileName, "processing", preview.validCards.length + preview.invalidCards.length, 0, preview.invalidCards.length, ctx.user.id]
      );
      batchId = (batchInsertResult as any).insertId;
    } finally {
      batchConnection.release();
    }

    // Insert valid cards with encrypted PINs using raw SQL to avoid Drizzle ORM auto-increment issues
    let insertedCount = 0;
    
    if (!rawDb) {
      throw new Error("Database connection not available");
    }
    
    for (const { card, rawPin } of preview.validCards) {
      // Use centralized encryption service (AES-256-GCM) for consistency with purchase flow
      const encryptedPin = await pinEncryptionService.encryptPIN(rawPin);
      const pinHash = hashPin(rawPin);

      // Use raw SQL to insert cards, bypassing Drizzle ORM's auto-increment handling
      const connection = await rawDb.getConnection();
      try {
        await connection.execute(
          `INSERT INTO cards (provider_id, product_id, batch_id, pin_encrypted, pin_hash, serial_number, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [providerId, preview.productId, batchId, encryptedPin, pinHash, card.serialNumber ?? null, "AVAILABLE"]
        );
      } finally {
        connection.release();
      }

      insertedCount++;
    }

    // Update batch with final counts
    await db
      .update(cardBatches)
      .set({
        processedCards: insertedCount,
        uploadStatus: "completed",
      })
      .where(eq(cardBatches.id, batchId));

    // Remove preview from cache
    deletePreview(input.uploadPreviewId);

    return {
      success: true,
      batchId,
      message: `Batch created successfully with ${insertedCount} cards`,
      insertedCount,
      failedCount: preview.invalidCards.length,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Confirm failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * ENDPOINT 3: cancelCardUpload
 * Rejects preview and cleans up cache
 */
export async function handleCancelCardUpload(
  ctx: any,
  input: z.infer<typeof cancelCardUploadInputSchema>
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection not available");

  if (!ctx.user?.providerId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User provider ID not found. Please contact support.",
    });
  }
  const providerId = ctx.user.providerId;

  try {
    // Load preview from cache
    const preview = getPreview(input.uploadPreviewId);
    if (!preview) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Preview not found or has expired",
      });
    }

    // Verify user owns preview
    validatePreviewOwnership(preview, providerId);

    // Delete preview from cache
    deletePreview(input.uploadPreviewId);

    return {
      success: true,
      message: "Upload cancelled - no batch created",
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Cancel failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
