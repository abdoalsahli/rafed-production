import { getRawDb, getDb, insertAuditLog } from "../db";
import { pinEncryptionService } from "./encryption.service";

export interface PinRevealResult {
  serialNumber: string | null;
  pin: string | null;
  note?: string;
}

/**
 * Atomically reveal a card PIN exactly once.
 *
 * Uses a single conditional UPDATE (no preceding SELECT) so there is no
 * TOCTOU window between reading pin_viewed and marking it consumed.
 * Concurrent callers race on the UPDATE; only the one that increments
 * affectedRows wins and receives the decrypted PIN. All others receive
 * { pin: null, note: "PIN already retrieved" }.
 */
export async function revealPinOnce(
  cardId: number,
  distributorId: number,
  credentialId: number,
  requestId: number,
  source: string,
): Promise<PinRevealResult> {
  const pool = await getRawDb();
  if (!pool) {
    return { serialNumber: null, pin: null, note: "Database unavailable" };
  }

  // Atomically claim the PIN reveal slot
  const [markResult]: any = await pool.query(
    "UPDATE cards SET pin_viewed = 1, updated_at = NOW() WHERE id = ? AND pin_viewed = 0",
    [cardId],
  );

  if (!markResult?.affectedRows) {
    // Another caller already consumed the reveal
    const [row]: any = await pool.query(
      "SELECT serial_number FROM cards WHERE id = ?",
      [cardId],
    );
    const serial = row?.[0]?.serial_number ?? null;
    return { serialNumber: serial, pin: null, note: "PIN already retrieved" };
  }

  // We own the reveal — fetch and decrypt
  const [row]: any = await pool.query(
    "SELECT pin_encrypted, serial_number FROM cards WHERE id = ?",
    [cardId],
  );
  const card = row?.[0];
  if (!card) {
    return { serialNumber: null, pin: null, note: "Card not found" };
  }

  try {
    const pin = await pinEncryptionService.decryptPIN(card.pin_encrypted);
    const db = await getDb();
    if (db) {
      await insertAuditLog(db, {
        userId: distributorId,
        action: "PIN_VIEWED",
        resourceId: cardId,
        metadata: { requestId, distributorId, credentialId, source },
      });
    }
    return { serialNumber: card.serial_number ?? null, pin };
  } catch (err) {
    console.error("[PinReveal] Decryption failed for card", cardId, err);
    return { serialNumber: card.serial_number ?? null, pin: null, note: "PIN decryption failed" };
  }
}
