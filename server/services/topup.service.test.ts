import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TopUpService } from "./topup.service";
import { getDb } from "../db";
import { Decimal } from "decimal.js";
import { sql } from "drizzle-orm";

function generateTestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

describe("TopUpService", () => {
  let topUpService: TopUpService;
  let db: any;

  beforeEach(async () => {
    topUpService = new TopUpService();
    db = await getDb();
  });

  afterEach(async () => {
    // Cleanup test data
    if (db) {
      try {
        await db.execute(
          sql`DELETE FROM provider_distributor_ledger WHERE reference_type = 'topup' AND reference_id LIKE 'test_%'`
        );
        await db.execute(
          sql`DELETE FROM provider_distributor_accounts WHERE provider_id > 10000 OR distributor_id > 10000`
        );
        await db.execute(
          sql`DELETE FROM distributors WHERE id > 10000`
        );
        await db.execute(
          sql`DELETE FROM service_providers WHERE id > 10000`
        );
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }
  });

  it("should successfully process a top-up", async () => {
    // Setup: Create test provider and distributor
    const providerId = 10000 + Math.floor(Math.random() * 1000);
    const distributorId = 10000 + Math.floor(Math.random() * 1000);
    const paymentId = `test_${generateTestId()}`;

    // Create provider
    await db.execute(
      sql`INSERT INTO service_providers (id, name, status) 
          VALUES (${providerId}, 'Test Provider', 'active')`
    );

    // Create distributor
    await db.execute(
      sql`INSERT INTO distributors (id, name, status) 
          VALUES (${distributorId}, 'Test Distributor', 'active')`
    );

    // Create account
    await db.execute(
      sql`INSERT INTO provider_distributor_accounts 
          (provider_id, distributor_id, balance, credit_line, used_credit, version) 
          VALUES (${providerId}, ${distributorId}, '1000.00', '5000.00', '0.00', 1)`
    );

    // Process top-up
    const topupAmount = new Decimal("500.00");
    const response = await topUpService.processTopUp({
      providerId,
      distributorId,
      amount: topupAmount,
      paymentId,
      description: "Test top-up",
    });

    // Verify response
    expect(response.success).toBe(true);
    expect(response.newBalance).toEqual(new Decimal("1500.00"));
    expect(response.message).toContain("successfully credited");

    // Verify account balance was updated
    const balance = await topUpService.getAccountBalance(providerId, distributorId);
    expect(balance).not.toBeNull();
    expect(balance!.balance).toEqual(new Decimal("1500.00"));
  });

  it("should create a ledger entry with referenceType = topup", async () => {
    const providerId = 10100 + Math.floor(Math.random() * 1000);
    const distributorId = 10100 + Math.floor(Math.random() * 1000);
    const paymentId = `test_${generateTestId()}`;

    // Create provider
    await db.execute(
      sql`INSERT INTO service_providers (id, name, status) 
          VALUES (${providerId}, 'Test Provider 2', 'active')`
    );

    // Create distributor
    await db.execute(
      sql`INSERT INTO distributors (id, name, status) 
          VALUES (${distributorId}, 'Test Distributor', 'active')`
    );

    // Create account
    await db.execute(
      sql`INSERT INTO provider_distributor_accounts 
          (provider_id, distributor_id, balance, credit_line, used_credit, version) 
          VALUES (${providerId}, ${distributorId}, '2000.00', '5000.00', '0.00', 1)`
    );

    // Process top-up
    const topupAmount = new Decimal("750.00");
    await topUpService.processTopUp({
      providerId,
      distributorId,
      amount: topupAmount,
      paymentId,
    });

    // Verify ledger entry
    const ledger = await topUpService.getLedgerHistory(providerId, distributorId, 1, 0);
    expect(ledger.length).toBeGreaterThan(0);

    const topupEntry = ledger[0];
    expect(topupEntry.type).toBe("CREDIT");
    expect(topupEntry.referenceType).toBe("topup");
    expect(topupEntry.referenceId).toBe(paymentId);
    expect(new Decimal(topupEntry.amount)).toEqual(topupAmount);
  });

  it("should reject invalid provider ID", async () => {
    expect(async () => {
      await topUpService.processTopUp({
        providerId: -1,
        distributorId: 1,
        amount: "100",
        paymentId: "test_123",
      });
    }).rejects.toThrow("Invalid provider ID");
  });

  it("should reject invalid distributor ID", async () => {
    expect(async () => {
      await topUpService.processTopUp({
        providerId: 1,
        distributorId: 0,
        amount: "100",
        paymentId: "test_123",
      });
    }).rejects.toThrow("Invalid distributor ID");
  });

  it("should reject invalid amount", async () => {
    expect(async () => {
      await topUpService.processTopUp({
        providerId: 1,
        distributorId: 1,
        amount: "-100",
        paymentId: "test_123",
      });
    }).rejects.toThrow("Invalid top-up amount");
  });

  it("should reject missing payment ID", async () => {
    expect(async () => {
      await topUpService.processTopUp({
        providerId: 1,
        distributorId: 1,
        amount: "100",
        paymentId: "",
      });
    }).rejects.toThrow("Payment ID is required");
  });

  it("should reject non-existent account", async () => {
    expect(async () => {
      await topUpService.processTopUp({
        providerId: 99999,
        distributorId: 99999,
        amount: "100",
        paymentId: "test_123",
      });
    }).rejects.toThrow("Account not found");
  });

  it("should retrieve account balance correctly", async () => {
    const providerId = 10200 + Math.floor(Math.random() * 1000);
    const distributorId = 10200 + Math.floor(Math.random() * 1000);

    // Create provider
    await db.execute(
      sql`INSERT INTO service_providers (id, name, status) 
          VALUES (${providerId}, 'Test Provider 3', 'active')`
    );

    // Create distributor
    await db.execute(
      sql`INSERT INTO distributors (id, name, status) 
          VALUES (${distributorId}, 'Test Distributor', 'active')`
    );

    // Create account with specific values
    const balance = "3000.00";
    const creditLine = "10000.00";
    const usedCredit = "2000.00";

    await db.execute(
      sql`INSERT INTO provider_distributor_accounts 
          (provider_id, distributor_id, balance, credit_line, used_credit, version) 
          VALUES (${providerId}, ${distributorId}, ${balance}, ${creditLine}, ${usedCredit}, 1)`
    );

    // Retrieve balance
    const result = await topUpService.getAccountBalance(providerId, distributorId);

    expect(result).not.toBeNull();
    expect(result!.balance).toEqual(new Decimal(balance));
    expect(result!.creditLine).toEqual(new Decimal(creditLine));
    expect(result!.usedCredit).toEqual(new Decimal(usedCredit));
    expect(result!.availableToSpend).toEqual(
      new Decimal(balance).plus(new Decimal(creditLine).minus(new Decimal(usedCredit)))
    );
  });

  it("should handle multiple top-ups to same account", async () => {
    const providerId = 10300 + Math.floor(Math.random() * 1000);
    const distributorId = 10300 + Math.floor(Math.random() * 1000);

    // Create provider
    await db.execute(
      sql`INSERT INTO service_providers (id, name, status) 
          VALUES (${providerId}, 'Test Provider 4', 'active')`
    );

    // Create distributor
    await db.execute(
      sql`INSERT INTO distributors (id, name, status) 
          VALUES (${distributorId}, 'Test Distributor', 'active')`
    );

    // Create account
    await db.execute(
      sql`INSERT INTO provider_distributor_accounts 
          (provider_id, distributor_id, balance, credit_line, used_credit, version) 
          VALUES (${providerId}, ${distributorId}, '1000.00', '5000.00', '0.00', 1)`
    );

    // First top-up
    const paymentId1 = `test_${generateTestId()}`;
    await topUpService.processTopUp({
      providerId,
      distributorId,
      amount: "500.00",
      paymentId: paymentId1,
    });

    // Second top-up
    const paymentId2 = `test_${generateTestId()}`;
    const response2 = await topUpService.processTopUp({
      providerId,
      distributorId,
      amount: "300.00",
      paymentId: paymentId2,
    });

    // Verify final balance
    expect(response2.newBalance).toEqual(new Decimal("1800.00"));

    // Verify both ledger entries exist
    const ledger = await topUpService.getLedgerHistory(providerId, distributorId, 10, 0);
    const topupEntries = ledger.filter((entry) => entry.referenceType === "topup");
    expect(topupEntries.length).toBeGreaterThan(1);
  });
});
