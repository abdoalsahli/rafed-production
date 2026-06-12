import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  cards,
  transactions,
  providerDistributorCommission,
  products,
  auditLogs,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _rawPool: any = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Get raw MySQL2 connection pool for raw SQL queries
export async function getRawDb() {
  if (!_rawPool && process.env.DATABASE_URL) {
    try {
      const mysql = await import('mysql2/promise');
      _rawPool = mysql.createPool(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to create raw pool:", error);
      _rawPool = null;
    }
  }
  return _rawPool;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * CRITICAL: Allocate a single available card using SELECT FOR UPDATE SKIP LOCKED
 * This ensures no two concurrent requests get the same card.
 * 
 * Returns the card with its encrypted PIN, or null if no cards available.
 * Must be called within a transaction context.
 */
/**
 * DEPRECATED: Use atomicAllocateAndMarkCard instead
 * This function has a race condition - SELECT and UPDATE are separate operations
 */
export async function allocateAvailableCard(db: any, providerId: number, productId: number) {
  // Use raw SQL for SELECT FOR UPDATE SKIP LOCKED since Drizzle doesn't support it directly
  const result = await db.execute(sql`
    SELECT id, pin_encrypted, provider_id, product_id
    FROM cards
    WHERE provider_id = ${providerId}
    AND product_id = ${productId}
    AND status = 'AVAILABLE'
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);

  return result[0] && result[0].length > 0 ? result[0][0] : null;
}

/**
 * Atomically allocate and mark a card as SOLD in a single UPDATE operation
 * This prevents race conditions by combining SELECT and UPDATE into one atomic operation.
 * 
 * @param db - Drizzle database instance (must be within a transaction)
 * @param providerId - Provider ID
 * @param productId - Product ID  
 * @param distributorId - Distributor ID to allocate the card to
 * @returns Card details if allocation succeeded, null if no cards available
 */
export async function atomicAllocateAndMarkCard(
  db: any,
  providerId: number,
  productId: number,
  distributorId: number
) {
  const now = new Date();

  // Atomic UPDATE with nested SELECT FOR UPDATE SKIP LOCKED
  // This ensures only ONE request can successfully update each card
  const result = await db.execute(sql`
    UPDATE cards
    SET status = 'SOLD',
        allocated_to_distributor_id = ${distributorId},
        allocated_at = ${now},
        updated_at = ${now}
    WHERE id = (
      SELECT id
      FROM cards
      WHERE provider_id = ${providerId}
      AND product_id = ${productId}
      AND status = 'AVAILABLE'
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
  `);

  // If no rows were updated, no cards were available
  if (!result.affectedRows || result.affectedRows === 0) {
    return null;
  }

  // Fetch the card we just updated to return its details
  const cardResult = await db.execute(sql`
    SELECT id, pin_encrypted, provider_id, product_id, allocated_to_distributor_id
    FROM cards
    WHERE provider_id = ${providerId}
    AND product_id = ${productId}
    AND allocated_to_distributor_id = ${distributorId}
    AND status = 'SOLD'
    ORDER BY allocated_at DESC
    LIMIT 1
  `);

  return cardResult[0] && cardResult[0].length > 0 ? cardResult[0][0] : null;
}

/**
 * Mark a card as SOLD and allocate it to a distributor
 * FIX #7: Safe update with WHERE status = 'AVAILABLE' to prevent double-selling
 */
export async function markCardAsSold(
  db: any,
  cardId: number,
  distributorId: number,
) {
  const now = new Date();
  const result = await db.execute(sql`
    UPDATE cards
    SET status = 'SOLD',
        allocated_to_distributor_id = ${distributorId},
        allocated_at = ${now},
        updated_at = ${now}
    WHERE id = ${cardId}
    AND status = 'AVAILABLE'
  `);

  // Verify the update succeeded
  if (!result.affectedRows || result.affectedRows === 0) {
    throw new Error("Failed to mark card as sold - card may have already been sold");
  }
}

/**
 * Record a transaction
 */
export async function recordTransaction(
  db: any,
  data: {
    idempotencyKey: string;
    distributorId: number;
    providerId: number;
    productId: number;
    cardId: number;
    amount: string;
    commissionAmount: string;
  },
) {
  const now = new Date();
  const result = await db.insert(transactions).values({
    idempotencyKey: data.idempotencyKey,
    distributorId: data.distributorId,
    providerId: data.providerId,
    productId: data.productId,
    cardId: data.cardId,
    amount: data.amount,
    commissionAmount: data.commissionAmount,
    transactionType: "purchase",
    status: "completed",
    createdAt: now,
    updatedAt: now,
  });

  return result.insertId;
}

/**
 * Get commission rate for a provider-distributor pair
 */
export async function getCommissionRate(
  db: any,
  providerId: number,
  distributorId: number,
) {
  const result = await db
    .select()
    .from(providerDistributorCommission)
    .where(
      and(
        eq(providerDistributorCommission.providerId, providerId),
        eq(providerDistributorCommission.distributorId, distributorId),
      ),
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Check if a transaction with the given idempotency key already exists
 * Used to prevent duplicate processing from POS retries
 */
export async function getTransactionByIdempotencyKey(
  db: any,
  idempotencyKey: string,
) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get product details
 */
export async function getProduct(db: any, productId: number) {
  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * ATOMIC PIN ACCESS CONTROL - 100% Race-Condition Safe
 * 
 * This function ensures exactly one request can access a PIN.
 * Uses atomic database operation: UPDATE with WHERE clause on pin_viewed.
 * 
 * CRITICAL: This MUST be called AFTER transaction commit to prevent
 * concurrent requests from both reading pin_viewed = 0.
 * 
 * Returns:
 * - { success: true } if PIN access granted (pin_viewed was 0, now 1)
 * - { success: false, error } if PIN already viewed (pin_viewed was already 1)
 * 
 * Guarantees:
 * - Exactly one request succeeds
 * - Other concurrent requests fail with "PIN already viewed"
 * - No race conditions possible
 */
export async function atomicMarkPinAsViewed(
  db: any,
  cardId: number,
): Promise<{ success: boolean; error?: string }> {
  // ATOMIC OPERATION: Single SQL UPDATE with WHERE clause.
  // db.execute(sql`...`) in Drizzle/MySQL2 returns [OkPacket, FieldPacket[]], so
  // affectedRows lives at result[0], not on the array itself.
  const result = await db.execute(sql`
    UPDATE cards
    SET pin_viewed = 1,
        updated_at = NOW()
    WHERE id = ${cardId}
    AND pin_viewed = 0
  `);

  // Handle both shapes: plain OkPacket and [OkPacket, ...] array
  const okPacket = Array.isArray(result) ? result[0] : result;

  if (okPacket?.affectedRows && okPacket.affectedRows > 0) {
    console.log(`[PIN Access] Granted - Card ${cardId} PIN marked as viewed`);
    return { success: true };
  } else {
    console.log(`[PIN Access] Denied - Card ${cardId} PIN already viewed`);
    return {
      success: false,
      error: "PIN already viewed. For security, PINs can only be retrieved once.",
    };
  }
}

/**
 * Get encrypted PIN from card (BEFORE atomic access control)
 * This is safe because we only return the encrypted PIN.
 * The actual decryption only happens if atomicMarkPinAsViewed succeeds.
 */
export async function getCardEncryptedPin(
  db: any,
  cardId: number,
): Promise<string | null> {
  const result = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);

  return result.length > 0 ? result[0].pinEncrypted : null;
}

export async function getCardDetails(
  db: any,
  cardId: number,
): Promise<{ pinEncrypted: string; serialNumber: string | null } | null> {
  const result = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);

  return result.length > 0
    ? { pinEncrypted: result[0].pinEncrypted, serialNumber: result[0].serialNumber ?? null }
    : null;
}

/**
 * AUDIT LOGGING - Append-only audit trail for compliance
 * 
 * CRITICAL: Audit logs are APPEND-ONLY. Rows are NEVER updated or deleted.
 * Each action creates a new immutable record for security and compliance.
 * 
 * This function is called AFTER sensitive actions succeed to ensure
 * we only log successful operations.
 * 
 * Returns: insertId of the audit log record
 */
export async function insertAuditLog(
  db: any,
  data: {
    userId: number; // Distributor ID
    action: string; // e.g., "PIN_VIEWED"
    resourceId: number; // e.g., card_id
    metadata?: Record<string, any>; // Additional context
  },
): Promise<number> {
  const result = await db.insert(auditLogs).values({
    userId: data.userId,
    action: data.action,
    resourceId: data.resourceId,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    createdAt: new Date(),
  });

  console.log(
    `[Audit] ${data.action} by user ${data.userId} on resource ${data.resourceId}`,
  );

  return result.insertId;
}
