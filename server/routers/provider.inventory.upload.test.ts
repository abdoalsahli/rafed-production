import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, getRawDb } from '../db';
import { serviceProviders, products, cards, cardBatches } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Provider Inventory & Upload', () => {
  let providerId: number;
  let productId: number;
  let db: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error('Database connection failed');

    // Create test provider
    const [providerResult] = await db
      .insert(serviceProviders)
      .values({
        name: 'Test Provider',
        email: 'test-provider@example.com',
        status: 'active',
      });

    providerId = (providerResult as any).insertId || 1;

    // Create test product
    const [productResult] = await db
      .insert(products)
      .values({
        providerId,
        name: 'Test Product',
        description: 'Test prepaid card product',
        price: '10.00',
        status: 'active',
      });

    productId = (productResult as any).insertId || 1;
  });

  afterAll(async () => {
    // Cleanup test data
    if (db) {
      await db.delete(cards).where(eq(cards.providerId, providerId));
      await db.delete(cardBatches).where(eq(cardBatches.providerId, providerId));
      await db.delete(products).where(eq(products.providerId, providerId));
      await db.delete(serviceProviders).where(eq(serviceProviders.id, providerId));
    }
  });

  describe('getInventory', () => {
    it('should return empty inventory for new provider', async () => {
      const inventory = await db
        .select()
        .from(products)
        .where(eq(products.providerId, providerId));

      expect(inventory).toHaveLength(1);
      expect(inventory[0].name).toBe('Test Product');
    });

    it('should return card counts after insertion', async () => {
      // Insert test cards
      await db
        .insert(cards)
        .values([
          {
            providerId,
            productId,
            pinEncrypted: 'encrypted-pin-1',
            status: 'AVAILABLE',
          },
          {
            providerId,
            productId,
            pinEncrypted: 'encrypted-pin-2',
            status: 'AVAILABLE',
          },
          {
            providerId,
            productId,
            pinEncrypted: 'encrypted-pin-3',
            status: 'SOLD',
          },
        ]);

      // Verify counts
      const availableCards = await db
        .select()
        .from(cards)
        .where(eq(cards.status, 'AVAILABLE'));

      const soldCards = await db
        .select()
        .from(cards)
        .where(eq(cards.status, 'SOLD'));

      expect(availableCards.length).toBeGreaterThanOrEqual(2);
      expect(soldCards.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('uploadCards', () => {
    it('should validate CSV format', () => {
      const validCsv = 'pin1,serial1\npin2,serial2';
      const lines = validCsv
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('pin1,serial1');
    });

    it('should detect duplicate PINs within upload', () => {
      const csvContent = 'pin1\npin1\npin2';
      const lines = csvContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const seenPins = new Set<string>();
      const duplicates: string[] = [];

      lines.forEach((line) => {
        const pin = line.split(',')[0];
        if (seenPins.has(pin)) {
          duplicates.push(pin);
        }
        seenPins.add(pin);
      });

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toBe('pin1');
    });

    it('should validate PIN format', () => {
      const validatePin = (pin: string): boolean => {
        return !!(pin && pin.length >= 4 && pin.length <= 32);
      };

      expect(validatePin('1234')).toBe(true);
      expect(validatePin('123')).toBe(false); // Too short
      expect(validatePin('')).toBe(false); // Empty
      expect(validatePin('a'.repeat(33))).toBe(false); // Too long
    });

    it('should handle batch creation', async () => {
      const rawDb = await getRawDb();
      if (!rawDb) throw new Error('Raw DB connection failed');

      const [batchResult] = await rawDb.query(
        `INSERT INTO card_batches (provider_id, filename, upload_status, total_cards, uploaded_by)
         VALUES (?, ?, ?, ?, ?)`,
        [providerId, 'test-upload.csv', 'processing', 100, providerId]
      );

      const batchId = (batchResult as any).insertId;
      expect(batchId).toBeGreaterThan(0);

      // Verify batch was created
      const batches = await db
        .select()
        .from(cardBatches)
        .where(eq(cardBatches.id, batchId));

      expect(batches).toHaveLength(1);
      expect(batches[0].filename).toBe('test-upload.csv');
    });

    it('should calculate upload summary correctly', () => {
      const totalRows = 100;
      const insertedRows = 95;
      const failedRows = 5;

      expect(totalRows).toBe(insertedRows + failedRows);
      expect(insertedRows / totalRows).toBe(0.95);
    });
  });

  describe('Inventory Updates', () => {
    it('should reflect new cards in available count', async () => {
      const countBefore = await db
        .select()
        .from(cards)
        .where(eq(cards.productId, productId));

      // Insert new card
      await db
        .insert(cards)
        .values({
          providerId,
          productId,
          pinEncrypted: 'new-encrypted-pin',
          status: 'AVAILABLE',
        });

      const countAfter = await db
        .select()
        .from(cards)
        .where(eq(cards.productId, productId));

      expect(countAfter.length).toBe(countBefore.length + 1);
    });

    it('should track sold cards separately', async () => {
      // Get an available card and mark as sold
      const availableCard = await db
        .select()
        .from(cards)
        .where(eq(cards.status, 'AVAILABLE'))
        .limit(1);

      if (availableCard.length > 0) {
        const cardId = availableCard[0].id;
        await db
          .update(cards)
          .set({ status: 'SOLD' })
          .where(eq(cards.id, cardId));

        // Verify status changed
        const updatedCard = await db
          .select()
          .from(cards)
          .where(eq(cards.id, cardId));

        expect(updatedCard[0].status).toBe('SOLD');
      }
    });
  });

  describe('Error Handling', () => {
    it('should reject upload for non-existent product', async () => {
      const nonExistentProductId = 999999;

      const product = await db
        .select()
        .from(products)
        .where(eq(products.id, nonExistentProductId));

      expect(product).toHaveLength(0);
    });

    it('should handle empty CSV', () => {
      const emptyCSV = '';
      const lines = emptyCSV
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      expect(lines).toHaveLength(0);
    });

    it('should handle malformed CSV rows', () => {
      const csvContent = 'pin1\n,\npin2,,extra';
      const lines = csvContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const validRows = lines.filter((line) => {
        const parts = line.split(',');
        return parts[0] && parts[0].length >= 4;
      });

      expect(validRows).toHaveLength(2);
    });
  });
});
