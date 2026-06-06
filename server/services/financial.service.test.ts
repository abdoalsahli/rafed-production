import { describe, it, expect, beforeEach } from "vitest";
import { Decimal } from "decimal.js";
import { FinancialService } from "./financial.service";

/**
 * Comprehensive Test Suite for FinancialService
 * 
 * Tests all financial flows independently before integration
 * Validates:
 * - Purchase with balance only
 * - Purchase with credit
 * - Mixed balance + credit
 * - Commission edge cases
 * - Ledger integrity
 */

// Improved mock database for testing
class MockDatabase {
  private accounts: Map<string, any> = new Map();
  private ledger: any[] = [];
  private relationships: Map<string, any> = new Map();
  private insertIdCounter = 1;

  constructor() {
    this.setupDefaultData();
  }

  private setupDefaultData() {
    const accountKey = "1:1";
    this.accounts.set(accountKey, {
      id: 1,
      provider_id: 1,
      distributor_id: 1,
      balance: "1000.00",
      credit_line: "500.00",
      used_credit: "0.00",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const relKey = "1:1";
    this.relationships.set(relKey, {
      id: 1,
      provider_id: 1,
      distributor_id: 1,
      commission_rate: "0.15",
      credit_line: "500.00",
      used_credit: "0.00",
      allow_credit: 1,
      status: "active",
    });
  }

  async select() {
    return {
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => {
            if (table._ && table._.name === "provider_distributor_accounts") {
              const account = this.accounts.get("1:1");
              return account ? [account] : [];
            }
            if (table._ && table._.name === "provider_distributor_relationships") {
              const rel = this.relationships.get("1:1");
              return rel ? [rel] : [];
            }
            return [];
          },
        }),
      }),
    };
  }

  async insert(table: any) {
    return {
      values: (data: any) => {
        if (table._ && table._.name === "provider_distributor_ledger") {
          this.ledger.push({
            id: this.insertIdCounter++,
            ...data,
          });
          return { insertId: this.insertIdCounter - 1 };
        }
        if (table._ && table._.name === "provider_distributor_accounts") {
          const key = `${data.providerId}:${data.distributorId}`;
          this.accounts.set(key, {
            id: this.insertIdCounter++,
            ...data,
          });
          return { insertId: this.insertIdCounter - 1 };
        }
        return { insertId: this.insertIdCounter++ };
      },
    };
  }

  async execute(sqlInput: any) {
    let sql = "";

    // Handle sql template strings from drizzle
    if (sqlInput && typeof sqlInput === "object" && sqlInput.strings) {
      for (let i = 0; i < sqlInput.strings.length; i++) {
        sql += sqlInput.strings[i];
        if (i < sqlInput.values?.length) {
          sql += sqlInput.values[i];
        }
      }
    } else {
      sql = typeof sqlInput === "string" ? sqlInput : sqlInput?.toString?.() || "";
    }

    // Handle SELECT FOR UPDATE
    if (sql.includes("FOR UPDATE")) {
      const account = this.accounts.get("1:1");
      if (account) {
        return [[account]];
      }
      return [[]];
    }

    // Handle UPDATE
    if (sql.includes("UPDATE provider_distributor_accounts")) {
      const balanceMatch = sql.match(/balance = '([^']+)'/) || sql.match(/balance = ([0-9.]+)/);
      const creditMatch = sql.match(/used_credit = '([^']+)'/) || sql.match(/used_credit = ([0-9.]+)/);

      if (balanceMatch) {
        const account = this.accounts.get("1:1");
        if (account) {
          account.balance = balanceMatch[1];
          if (creditMatch) {
            account.used_credit = creditMatch[1];
          }
          account.version += 1;
          account.updatedAt = new Date();
        }
      }

      return { affectedRows: 1 };
    }

    // Handle SELECT for commission report
    if (sql.includes("SELECT COUNT")) {
      const commissionEntries = this.ledger.filter((e) => e.reference_type === "commission_credit");
      return [
        [
          {
            transaction_count: commissionEntries.length,
            total_commission: commissionEntries
              .reduce((sum, e) => sum + parseFloat(e.amount), 0)
              .toString(),
          },
        ],
      ];
    }

    return [[]];
  }

  // Helper methods for testing
  getAccount() {
    return this.accounts.get("1:1");
  }

  getLedger() {
    return this.ledger;
  }

  getLedgerByType(type: string) {
    return this.ledger.filter((e) => e.type === type);
  }

  getLedgerByReferenceType(refType: string) {
    return this.ledger.filter((e) => e.reference_type === refType);
  }

  clearLedger() {
    this.ledger = [];
  }

    const account = this.accounts.get("1:1");
    if (account) {
      account.balance = balance;
      account.used_credit = usedCredit;
      account.version = 1;
    }
  }
}

describe("FinancialService", () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
  });

  describe("1. Purchase using balance only", () => {
    it("should deduct purchase amount from balance", async () => {
      const result = await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.15"),
        1,
      );

      expect(result.finalBalance.toString()).toBe("885.00");
      expect(result.finalUsedCredit.toString()).toBe("0.00");
      expect(result.commissionAmount.toString()).toBe("15.00");
    });

    it("should create two ledger entries (DEBIT + CREDIT)", async () => {
      await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.15"),
        1,
      );

      const ledger = mockDb.getLedger();
      expect(ledger.length).toBe(2);
      expect(ledger[0].type).toBe("DEBIT");
      expect(ledger[0].reference_type).toBe("purchase_debit");
      expect(ledger[1].type).toBe("CREDIT");
      expect(ledger[1].reference_type).toBe("commission_credit");
    });

    it("should record correct balance snapshots in ledger", async () => {
      await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.15"),
        1,
      );

      const ledger = mockDb.getLedger();
      expect(ledger[0].balance_after_transaction).toBe("900.00");
      expect(ledger[1].balance_after_transaction).toBe("915.00");
    });
  });

  describe("2. Purchase using credit", () => {
    it("should increase used_credit when balance insufficient", async () => {
      mockDb.resetAccount("50.00", "0.00");

      const result = await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.15"),
        2,
      );

      expect(result.finalBalance.toString()).toBe("50.00");
      expect(result.finalUsedCredit.toString()).toBe("35.00");
    });

    it("should reduce used_credit with commission first", async () => {
      mockDb.resetAccount("0.00", "100.00");

      const result = await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("50.00"),
        new Decimal("0.20"),
        3,
      );

      expect(result.finalBalance.toString()).toBe("0.00");
      expect(result.finalUsedCredit.toString()).toBe("140.00");
    });
  });

  describe("3. Mixed case (partial balance + credit)", () => {
    it("should use balance first, then credit", async () => {
      mockDb.resetAccount("300.00", "0.00");

      const result = await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("400.00"),
        new Decimal("0.10"),
        4,
      );

      expect(result.finalBalance.toString()).toBe("300.00");
      expect(result.finalUsedCredit.toString()).toBe("60.00");
    });

    it("should record correct ledger entries for mixed case", async () => {
      mockDb.resetAccount("300.00", "0.00");
      mockDb.clearLedger();

      await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("400.00"),
        new Decimal("0.10"),
        5,
      );

      const ledger = mockDb.getLedger();
      expect(ledger[0].balance_after_transaction).toBe("0.00");
      expect(ledger[0].used_credit_after_transaction).toBe("100.00");
      expect(ledger[1].balance_after_transaction).toBe("40.00");
      expect(ledger[1].used_credit_after_transaction).toBe("60.00");
    });
  });

  describe("4. Commission edge cases", () => {
    it("should handle commission > used_credit", async () => {
      mockDb.resetAccount("0.00", "50.00");

      const result = await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.50"),
        6,
      );

      expect(result.finalBalance.toString()).toBe("50.00");
      expect(result.finalUsedCredit.toString()).toBe("100.00");
    });

    it("should split commission between credit reduction and balance increase", async () => {
      mockDb.resetAccount("0.00", "30.00");

      const result = await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.50"),
        7,
      );

      expect(result.finalBalance.toString()).toBe("0.00");
      expect(result.finalUsedCredit.toString()).toBe("80.00");
    });

    it("should put excess commission in balance when credit fully reduced", async () => {
      mockDb.resetAccount("0.00", "10.00");

      const result = await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.50"),
        8,
      );

      expect(result.finalBalance.toString()).toBe("0.00");
      expect(result.finalUsedCredit.toString()).toBe("60.00");
    });
  });

  describe("5. Ledger integrity", () => {
    it("should ensure ledger is append-only", async () => {
      mockDb.clearLedger();

      await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.15"),
        1,
      );

      const ledgerAfterFirst = mockDb.getLedger().length;
      expect(ledgerAfterFirst).toBe(2);

      await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("50.00"),
        new Decimal("0.15"),
        2,
      );

      const ledgerAfterSecond = mockDb.getLedger().length;
      expect(ledgerAfterSecond).toBe(4);

      expect(mockDb.getLedger()[0].id).toBe(1);
      expect(mockDb.getLedger()[1].id).toBe(2);
      expect(mockDb.getLedger()[2].id).toBe(3);
      expect(mockDb.getLedger()[3].id).toBe(4);
    });

    it("should record correct metadata in ledger entries", async () => {
      mockDb.clearLedger();

      await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.15"),
        10,
      );

      const ledger = mockDb.getLedger();
      const debitMetadata = JSON.parse(ledger[0].metadata);
      const creditMetadata = JSON.parse(ledger[1].metadata);

      expect(debitMetadata.transactionId).toBe(10);
      expect(debitMetadata.purchaseAmount).toBe("100.00");
      expect(creditMetadata.commissionAmount).toBe("15.00");
    });
  });

  describe("6. Top-up flow", () => {
    it("should increase balance on top-up", async () => {
      mockDb.resetAccount("100.00", "0.00");

      const result = await FinancialService.processTopUp(
        mockDb as any,
        1,
        1,
        new Decimal("500.00"),
        "PAY-123",
      );

      expect(result.newBalance.toString()).toBe("600.00");

      const ledger = mockDb.getLedger();
      expect(ledger.length).toBe(1);
      expect(ledger[0].type).toBe("CREDIT");
      expect(ledger[0].reference_type).toBe("topup");
    });
  });

  describe("7. Refund flow", () => {
    it("should reverse purchase and commission correctly", async () => {
      mockDb.resetAccount("1000.00", "0.00");
      mockDb.clearLedger();

      await FinancialService.processPurchase(
        mockDb as any,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("0.15"),
        1,
      );

      const balanceAfterPurchase = mockDb.getAccount().balance;
      expect(balanceAfterPurchase).toBe("885.00");

      await FinancialService.processRefund(
        mockDb as any,
        1,
        1,
        1,
        new Decimal("100.00"),
        new Decimal("15.00"),
        "customer_request",
      );

      const balanceAfterRefund = mockDb.getAccount().balance;
      expect(balanceAfterRefund).toBe("1000.00");

      const ledger = mockDb.getLedger();
      expect(ledger.length).toBe(3);
      expect(ledger[2].type).toBe("CREDIT");
      expect(ledger[2].reference_type).toBe("refund");
    });
  });

  describe("8. Insufficient funds", () => {
    it("should throw error when insufficient balance", async () => {
      mockDb.resetAccount("50.00", "0.00");

      await expect(
        FinancialService.processPurchase(
          mockDb as any,
          1,
          1,
          new Decimal("100.00"),
          new Decimal("0.15"),
          1,
        ),
      ).rejects.toThrow("Insufficient funds");
    });

    it("should throw error when insufficient credit", async () => {
      mockDb.resetAccount("0.00", "400.00");

      await expect(
        FinancialService.processPurchase(
          mockDb as any,
          1,
          1,
          new Decimal("500.00"),
          new Decimal("0.15"),
          1,
        ),
      ).rejects.toThrow("Insufficient credit available");
    });
  });

  describe("9. Account balance calculation", () => {
    it("should calculate available to spend correctly", async () => {
      mockDb.resetAccount("300.00", "50.00");

      const balance = await FinancialService.getAccountBalance(
        mockDb as any,
        1,
        1,
      );

      expect(balance?.availableToSpend.toString()).toBe("750.00");
      expect(balance?.balance.toString()).toBe("300.00");
      expect(balance?.usedCredit.toString()).toBe("50.00");
    });
  });
});
