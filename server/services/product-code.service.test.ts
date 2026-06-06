import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductCodeService } from "./product-code.service";
import { getDb } from "../db";

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

const mockGetDb = vi.mocked(getDb);

describe("ProductCodeService", () => {
  describe("lookupByCode", () => {
    it("should find product by provider and product code", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn()
          .mockResolvedValueOnce([
            { id: 1, providerCode: "ZAIN", name: "Zain" },
          ])
          .mockResolvedValueOnce([
            {
              id: 150005,
              providerId: 1,
              productCode: "STEAM_10",
              name: "Steam 10 USD",
            },
          ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.lookupByCode(
        "ZAIN",
        "STEAM_10"
      );

      expect(result).toEqual({
        productId: 150005,
        providerId: 1,
        productCode: "STEAM_10",
        providerCode: "ZAIN",
      });
    });

    it("should return null if provider not found", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.lookupByCode(
        "NONEXISTENT",
        "STEAM_10"
      );

      expect(result).toBeNull();
    });

    it("should return null if product not found", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 1, providerCode: "ZAIN", name: "Zain" },
          ])
          .mockResolvedValueOnce([]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.lookupByCode(
        "ZAIN",
        "NONEXISTENT"
      );

      expect(result).toBeNull();
    });
  });

  describe("lookupById", () => {
    it("should find product by numeric ID", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 1, providerCode: "ZAIN", name: "Zain" },
          ])
          .mockResolvedValueOnce([
            {
              id: 150005,
              providerId: 1,
              productCode: "STEAM_10",
              name: "Steam 10 USD",
            },
          ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.lookupById(1, 150005);

      expect(result).toEqual({
        productId: 150005,
        providerId: 1,
        productCode: "STEAM_10",
        providerCode: "ZAIN",
      });
    });

    it("should return null if provider not found", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.lookupById(999, 150005);

      expect(result).toBeNull();
    });

    it("should return null if product not found", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 1, providerCode: "ZAIN", name: "Zain" },
          ])
          .mockResolvedValueOnce([]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.lookupById(1, 999);

      expect(result).toBeNull();
    });
  });

  describe("assignProductCode", () => {
    it("should assign product code to a product", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 150005,
              providerId: 1,
              productCode: null,
              name: "Steam 10 USD",
            },
          ])
          .mockResolvedValueOnce([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      await ProductCodeService.assignProductCode(1, 150005, "STEAM_10");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ productCode: "STEAM_10" });
    });

    it("should reject invalid product code format", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([
          {
            id: 150005,
            providerId: 1,
            productCode: null,
            name: "Steam 10 USD",
          },
        ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      await expect(
        ProductCodeService.assignProductCode(1, 150005, "steam-10")
      ).rejects.toThrow("Invalid product code format");
    });

    it("should prevent reassigning product code (immutability)", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([
          {
            id: 150005,
            providerId: 1,
            productCode: "STEAM_10",
            name: "Steam 10 USD",
          },
        ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      await expect(
        ProductCodeService.assignProductCode(1, 150005, "STEAM_20")
      ).rejects.toThrow("Product code is immutable");
    });

    it("should reject duplicate product code within provider", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 150005,
              providerId: 1,
              productCode: null,
              name: "Steam 10 USD",
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 150006,
              providerId: 1,
              productCode: "STEAM_10",
              name: "Steam 10 USD (duplicate)",
            },
          ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      await expect(
        ProductCodeService.assignProductCode(1, 150005, "STEAM_10")
      ).rejects.toThrow("already assigned to another product");
    });

    it("should throw error if product not found", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      await expect(
        ProductCodeService.assignProductCode(1, 999, "STEAM_10")
      ).rejects.toThrow("Product not found");
    });
  });

  describe("getProviderProductCodes", () => {
    it("should return all product codes for a provider", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 150005,
            productCode: "STEAM_10",
            name: "Steam 10 USD",
            displayName: "Steam $10",
            price: "10.00",
          },
          {
            id: 150006,
            productCode: "STEAM_20",
            name: "Steam 20 USD",
            displayName: "Steam $20",
            price: "20.00",
          },
        ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.getProviderProductCodes(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productId: 150005,
        productCode: "STEAM_10",
        name: "Steam 10 USD",
        displayName: "Steam $10",
        price: "10.00",
      });
    });

    it("should return empty array if provider has no products", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.getProviderProductCodes(999);

      expect(result).toEqual([]);
    });
  });

  describe("validateBackwardCompatibility", () => {
    it("should validate backward compatibility", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 1, providerCode: "ZAIN", name: "Zain" },
          ])
          .mockResolvedValueOnce([
            {
              id: 150005,
              providerId: 1,
              productCode: "STEAM_10",
              name: "Steam 10 USD",
            },
          ])
          .mockResolvedValueOnce([
            { id: 1, providerCode: "ZAIN", name: "Zain" },
          ])
          .mockResolvedValueOnce([
            {
              id: 150005,
              providerId: 1,
              productCode: "STEAM_10",
              name: "Steam 10 USD",
            },
          ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.validateBackwardCompatibility(
        1,
        150005
      );

      expect(result.isCompatible).toBe(true);
      expect(result.numericLookup).toBeDefined();
      expect(result.codeLookup).toBeDefined();
    });

    it("should return false if product code not assigned", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValueOnce([
            { id: 1, providerCode: "ZAIN", name: "Zain" },
          ])
          .mockResolvedValueOnce([
            {
              id: 150005,
              providerId: 1,
              productCode: null,
              name: "Steam 10 USD",
            },
          ]),
      };

      mockGetDb.mockResolvedValue(mockDb as any);

      const result = await ProductCodeService.validateBackwardCompatibility(
        1,
        150005
      );

      expect(result.isCompatible).toBe(false);
    });
  });
});
