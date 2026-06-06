import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ParsedCard } from "../utils/file-parser";

export interface UploadPreview {
  uploadPreviewId: string;
  providerId: number;
  productId: number;
  fileName: string;
  validCards: Array<{ card: ParsedCard; rawPin: string }>;
  invalidCards: Array<{ rowNumber: number; pin: string; error: string }>;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory cache with TTL (15 minutes)
// For production, use Redis
const uploadPreviewCache = new Map<string, UploadPreview>();

// Cleanup expired previews periodically
setInterval(() => {
  const now = new Date();
  uploadPreviewCache.forEach((preview, id) => {
    if (preview.expiresAt < now) {
      uploadPreviewCache.delete(id);
    }
  });
}, 60000); // Every minute

export function generatePreviewId(): string {
  return `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function storePreview(preview: UploadPreview): void {
  uploadPreviewCache.set(preview.uploadPreviewId, preview);
}

export function getPreview(uploadPreviewId: string): UploadPreview | undefined {
  const preview = uploadPreviewCache.get(uploadPreviewId);
  if (!preview) return undefined;

  // Check if expired
  if (preview.expiresAt < new Date()) {
    uploadPreviewCache.delete(uploadPreviewId);
    return undefined;
  }

  return preview;
}

export function deletePreview(uploadPreviewId: string): void {
  uploadPreviewCache.delete(uploadPreviewId);
}

export function validatePreviewOwnership(
  preview: UploadPreview,
  providerId: number
): void {
  if (preview.providerId !== providerId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this preview",
    });
  }
}

export const previewCardUploadInputSchema = z.object({
  productId: z.number().int().positive(),
  csvContent: z.string().optional(),
  fileBuffer: z.string().optional(), // Base64 encoded file buffer
  fileName: z.string().default("upload.csv"),
});

export const confirmCardUploadInputSchema = z.object({
  uploadPreviewId: z.string().min(1),
});

export const cancelCardUploadInputSchema = z.object({
  uploadPreviewId: z.string().min(1),
});
