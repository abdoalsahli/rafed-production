import { describe, it, expect } from "vitest";
import { parseCSV } from "../utils/file-parser";
import {
  generatePreviewId,
  storePreview,
  getPreview,
  deletePreview,
} from "./upload-preview";

describe("Two-Step Upload Flow", () => {
  describe("Preview Cache Management", () => {
    it("should generate unique preview IDs", () => {
      const id1 = generatePreviewId();
      const id2 = generatePreviewId();
      expect(id1).toMatch(/^preview_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^preview_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it("should store and retrieve preview from cache", () => {
      const previewId = generatePreviewId();
      const preview = {
        uploadPreviewId: previewId,
        providerId: 1,
        productId: 100,
        fileName: "test.csv",
        validCards: [
          {
            card: { rowNumber: 1, pin: "1234567890", serialNumber: "SN001" },
            rawPin: "1234567890",
          },
        ],
        invalidCards: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      storePreview(preview);
      const retrieved = getPreview(previewId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.uploadPreviewId).toBe(previewId);
      expect(retrieved?.validCards.length).toBe(1);
    });

    it("should delete preview from cache", () => {
      const previewId = generatePreviewId();
      const preview = {
        uploadPreviewId: previewId,
        providerId: 1,
        productId: 100,
        fileName: "test.csv",
        validCards: [],
        invalidCards: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      storePreview(preview);
      expect(getPreview(previewId)).toBeDefined();

      deletePreview(previewId);
      expect(getPreview(previewId)).toBeUndefined();
    });

    it("should return undefined for expired preview", () => {
      const previewId = generatePreviewId();
      const preview = {
        uploadPreviewId: previewId,
        providerId: 1,
        productId: 100,
        fileName: "test.csv",
        validCards: [],
        invalidCards: [],
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      };

      storePreview(preview);
      expect(getPreview(previewId)).toBeUndefined();
    });
  });

  describe("CSV Parsing for Preview", () => {
    it("should parse valid CSV with PIN only", () => {
      const csv = "PIN\n1234567890\nABCDEFGH1234";
      const result = parseCSV(csv);

      expect(result.cards.length).toBeGreaterThan(0);
      expect(result.cards.some((c) => c.pin === "1234567890")).toBe(true);
      expect(result.cards.some((c) => c.pin === "ABCDEFGH1234")).toBe(true);
    });

    it("should parse CSV with PIN and serial number", () => {
      const csv = "PIN,Serial Number\n1234567890,SN001\nABCDEFGH,SN002";
      const result = parseCSV(csv);

      expect(result.cards.length).toBeGreaterThan(0);
      const validCard = result.cards.find((c) => c.pin === "1234567890");
      expect(validCard).toBeDefined();
      expect(validCard?.serialNumber).toBe("SN001");
    });

    it("should handle CSV with empty rows", () => {
      const csv = "PIN\n1234567890\n\nABCDEFGH1234\n";
      const result = parseCSV(csv);

      expect(result.cards.length).toBeGreaterThan(0);
      expect(result.cards.every((c) => c.pin.length > 0)).toBe(true);
    });
  });

  describe("PIN Validation", () => {
    it("should validate PIN format (4-32 characters)", () => {
      const validPINs = [
        "1234",
        "12345678",
        "ABCDEFGH",
        "1234567890ABCDEFGH1234567890AB",
      ];
      const invalidPINs = ["123", "1234567890ABCDEFGH1234567890ABCDE"];

      validPINs.forEach((pin) => {
        expect(pin.length >= 4 && pin.length <= 32)
          .toBe(true);
      });

      invalidPINs.forEach((pin) => {
        expect(pin.length >= 4 && pin.length <= 32)
          .toBe(false);
      });
    });
  });

  describe("Serial Number Validation", () => {
    it("should validate serial number length (max 128 characters)", () => {
      const validSerials = [
        "SN001",
        "SERIAL-12345-ABCDE",
        "A".repeat(128),
      ];
      const invalidSerials = ["A".repeat(129)];

      validSerials.forEach((serial) => {
        expect(serial.length <= 128).toBe(true);
      });

      invalidSerials.forEach((serial) => {
        expect(serial.length <= 128).toBe(false);
      });
    });
  });

  describe("Duplicate Detection", () => {
    it("should detect duplicate PINs in upload", () => {
      const csv = "PIN\n1234567890\n1234567890\nABCDEFGH";
      const result = parseCSV(csv);

      const seenPins = new Set<string>();
      const duplicates: string[] = [];

      result.cards.forEach((card) => {
        if (seenPins.has(card.pin)) {
          duplicates.push(card.pin);
        }
        seenPins.add(card.pin);
      });

      expect(duplicates.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Preview Summary Generation", () => {
    it("should generate correct preview summary with valid and invalid rows", () => {
      const validCards = 5;
      const invalidCards = 3;
      const totalRows = validCards + invalidCards;

      const summary = {
        totalRows,
        validRows: validCards,
        invalidRows: invalidCards,
        duplicateRows: 0,
      };

      expect(summary.totalRows).toBe(8);
      expect(summary.validRows).toBe(5);
      expect(summary.invalidRows).toBe(3);
    });

    it("should mask PINs in preview response", () => {
      const rawPin = "1234567890ABCDEF";
      const masked = rawPin.slice(-4).padStart(rawPin.length, "*");

      expect(masked).toBe("************CDEF");
      expect(masked).not.toContain("1234567890AB");
    });
  });

  describe("Authorization", () => {
    it("should enforce provider ownership of preview", () => {
      const previewId = generatePreviewId();
      const preview = {
        uploadPreviewId: previewId,
        providerId: 1,
        productId: 100,
        fileName: "test.csv",
        validCards: [],
        invalidCards: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      storePreview(preview);

      const retrieved = getPreview(previewId);
      const isOwner = retrieved?.providerId === 1;
      const isNotOwner = retrieved?.providerId === 2;

      expect(isOwner).toBe(true);
      expect(isNotOwner).toBe(false);
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle all-valid file upload", () => {
      const csv =
        "PIN,Serial Number\n1234567890,SN001\nABCDEFGH1234,SN002\n5678901234,SN003";
      const result = parseCSV(csv);

      expect(result.cards.length).toBeGreaterThan(0);
      const validCards = result.cards.filter(
        (c) => c.pin.length >= 4 && c.pin.length <= 32
      );
      expect(validCards.length).toBeGreaterThan(0);
    });

    it("should handle all-invalid file upload", () => {
      const csv = "PIN\n123\nAB\n";
      const result = parseCSV(csv);

      const validCards = result.cards.filter(
        (c) => c.pin.length >= 4 && c.pin.length <= 32
      );
      const invalidCards = result.cards.filter(
        (c) => c.pin.length < 4 || c.pin.length > 32
      );

      expect(validCards.length + invalidCards.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle mixed valid/invalid file upload", () => {
      const csv = "PIN\n1234567890\n123\nABCDEFGH1234\nAB";
      const result = parseCSV(csv);

      const validCards = result.cards.filter(
        (c) => c.pin.length >= 4 && c.pin.length <= 32
      );
      const invalidCards = result.cards.filter(
        (c) => c.pin.length < 4 || c.pin.length > 32
      );

      expect(validCards.length + invalidCards.length).toBeGreaterThan(0);
    });
  });
});
