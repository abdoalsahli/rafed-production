/**
 * Atomic Card Allocation - Using single UPDATE ... SELECT FOR UPDATE
 * 
 * This module provides atomic card allocation that prevents race conditions
 * by combining the SELECT and UPDATE into a single atomic operation.
 * 
 * The key insight: Use UPDATE with a WHERE clause that includes the card selection
 * criteria, ensuring only ONE request can successfully update the card.
 */

import { sql } from "drizzle-orm";

/**
 * Atomically allocate and mark a card as SOLD in a single operation
 * 
 * This prevents race conditions by:
 * 1. Selecting an AVAILABLE card with FOR UPDATE SKIP LOCKED
 * 2. Immediately marking it as SOLD in the same transaction
 * 3. Returning the allocated card details
 * 
 * Only ONE concurrent request will successfully allocate each card.
 * Others will get SKIP LOCKED and try the next available card.
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

  // Use raw SQL to perform atomic SELECT FOR UPDATE + UPDATE in one operation
  // This ensures that:
  // 1. We lock the first available card
  // 2. We immediately mark it as SOLD
  // 3. No other request can get the same card
  
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
 * Alternative: Use stored procedure for even better atomicity
 * (if database supports it)
 * 
 * CREATE PROCEDURE AllocateCard(
 *   IN p_provider_id INT,
 *   IN p_product_id INT,
 *   IN p_distributor_id INT,
 *   OUT p_card_id INT,
 *   OUT p_pin_encrypted TEXT
 * )
 * BEGIN
 *   DECLARE EXIT HANDLER FOR SQLEXCEPTION
 *   BEGIN
 *     SET p_card_id = NULL;
 *     SET p_pin_encrypted = NULL;
 *   END;
 * 
 *   START TRANSACTION;
 * 
 *   SELECT id, pin_encrypted INTO p_card_id, p_pin_encrypted
 *   FROM cards
 *   WHERE provider_id = p_provider_id
 *   AND product_id = p_product_id
 *   AND status = 'AVAILABLE'
 *   ORDER BY id ASC
 *   LIMIT 1
 *   FOR UPDATE SKIP LOCKED;
 * 
 *   IF p_card_id IS NOT NULL THEN
 *     UPDATE cards
 *     SET status = 'SOLD',
 *         allocated_to_distributor_id = p_distributor_id,
 *         allocated_at = NOW(),
 *         updated_at = NOW()
 *     WHERE id = p_card_id;
 *   END IF;
 * 
 *   COMMIT;
 * END;
 */
