import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for Corrected Financial Logic
 * 
 * Tests the corrected purchase account update logic that properly handles
 * balance vs. credit line funding.
 */

interface AccountState {
  balance: number;
  creditLine: number;
  usedCredit: number;
}

interface PurchaseResult {
  success: boolean;
  newBalance?: number;
  newUsedCredit?: number;
  availableAfter?: number;
  error?: string;
}

/**
 * Simulates the corrected purchase logic
 */
function processPurchase(account: AccountState, price: number): PurchaseResult {
  const { balance, creditLine, usedCredit } = account;

  // Step 1: Calculate available balance
  const availableToSpend = balance + (creditLine - usedCredit);

  // Step 2: Validate
  if (availableToSpend < price) {
    return {
      success: false,
      error: `Insufficient balance. Available: ${availableToSpend}, Required: ${price}`,
    };
  }

  // Step 3: Apply corrected logic
  let newBalance = balance;
  let newUsedCredit = usedCredit;

  if (newBalance >= price) {
    // Use balance only
    newBalance = newBalance - price;
    // usedCredit remains unchanged
  } else {
    // Use balance + credit line
    const creditUsed = price - newBalance;
    newBalance = 0;
    newUsedCredit = newUsedCredit + creditUsed;
  }

  // Step 4: Calculate new available balance
  const availableAfter = newBalance + (creditLine - newUsedCredit);

  return {
    success: true,
    newBalance,
    newUsedCredit,
    availableAfter,
  };
}

describe('Corrected Financial Logic - Account Updates', () => {
  describe('Test 1: Balance-only purchase', () => {
    it('should deduct from balance only when balance is sufficient', () => {
      const account: AccountState = {
        balance: 1000,
        creditLine: 1000,
        usedCredit: 0,
      };

      const result = processPurchase(account, 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(900);
      expect(result.newUsedCredit).toBe(0);
      expect(result.availableAfter).toBe(1900);

      // Verify: available decreased by exactly purchase amount
      const availableBefore = account.balance + (account.creditLine - account.usedCredit);
      const availableDecrease = availableBefore - result.availableAfter!;
      expect(availableDecrease).toBe(100);
    });
  });

  describe('Test 2: Credit-only purchase', () => {
    it('should use credit line when balance is zero', () => {
      const account: AccountState = {
        balance: 0,
        creditLine: 1000,
        usedCredit: 0,
      };

      const result = processPurchase(account, 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
      expect(result.newUsedCredit).toBe(100);
      expect(result.availableAfter).toBe(900);

      // Verify: available decreased by exactly purchase amount
      const availableBefore = account.balance + (account.creditLine - account.usedCredit);
      const availableDecrease = availableBefore - result.availableAfter!;
      expect(availableDecrease).toBe(100);
    });
  });

  describe('Test 3: Mixed balance + credit purchase', () => {
    it('should use balance first, then credit line', () => {
      const account: AccountState = {
        balance: 50,
        creditLine: 1000,
        usedCredit: 0,
      };

      const result = processPurchase(account, 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0); // Balance depleted
      expect(result.newUsedCredit).toBe(50); // Credit used for remaining 50
      expect(result.availableAfter).toBe(950);

      // Verify: available decreased by exactly purchase amount
      const availableBefore = account.balance + (account.creditLine - account.usedCredit);
      const availableDecrease = availableBefore - result.availableAfter!;
      expect(availableDecrease).toBe(100);
    });
  });

  describe('Test 4: Insufficient funds', () => {
    it('should reject purchase when total available is insufficient', () => {
      const account: AccountState = {
        balance: 0,
        creditLine: 100,
        usedCredit: 100,
      };

      const result = processPurchase(account, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });
  });

  describe('Test 5: Sequential purchases', () => {
    it('should handle multiple purchases correctly', () => {
      let account: AccountState = {
        balance: 1000,
        creditLine: 1000,
        usedCredit: 0,
      };

      // Purchase 1: 600
      const result1 = processPurchase(account, 600);
      expect(result1.success).toBe(true);
      expect(result1.newBalance).toBe(400);
      expect(result1.newUsedCredit).toBe(0);
      expect(result1.availableAfter).toBe(1400);

      // Update account state
      account = {
        balance: result1.newBalance!,
        creditLine: account.creditLine,
        usedCredit: result1.newUsedCredit!,
      };

      // Purchase 2: 500
      const result2 = processPurchase(account, 500);
      expect(result2.success).toBe(true);
      expect(result2.newBalance).toBe(0); // Balance depleted
      expect(result2.newUsedCredit).toBe(100); // Credit used for remaining 100
      expect(result2.availableAfter).toBe(900);

      // Update account state
      account = {
        balance: result2.newBalance!,
        creditLine: account.creditLine,
        usedCredit: result2.newUsedCredit!,
      };

      // Purchase 3: 100
      const result3 = processPurchase(account, 100);
      expect(result3.success).toBe(true);
      expect(result3.newBalance).toBe(0); // Still zero
      expect(result3.newUsedCredit).toBe(200); // Credit increased by 100
      expect(result3.availableAfter).toBe(800);

      // Verify final state
      expect(result3.newBalance).toBe(0);
      expect(result3.newUsedCredit).toBe(200);
      const finalAvailable = result3.newBalance + (1000 - result3.newUsedCredit);
      expect(finalAvailable).toBe(800);
    });
  });

  describe('Edge Cases', () => {
    it('should handle purchase equal to balance', () => {
      const account: AccountState = {
        balance: 100,
        creditLine: 1000,
        usedCredit: 0,
      };

      const result = processPurchase(account, 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
      expect(result.newUsedCredit).toBe(0);
      expect(result.availableAfter).toBe(1000);
    });

    it('should handle purchase equal to available balance', () => {
      const account: AccountState = {
        balance: 100,
        creditLine: 1000,
        usedCredit: 900,
      };

      const result = processPurchase(account, 200);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);
      expect(result.newUsedCredit).toBe(1000); // Credit increased by 100 (200 - 100 balance)
      expect(result.availableAfter).toBe(0);
    });

    it('should handle zero purchase', () => {
      const account: AccountState = {
        balance: 1000,
        creditLine: 1000,
        usedCredit: 0,
      };

      const result = processPurchase(account, 0);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1000);
      expect(result.newUsedCredit).toBe(0);
      expect(result.availableAfter).toBe(2000);
    });

    it('should handle account with partial credit used', () => {
      const account: AccountState = {
        balance: 500,
        creditLine: 1000,
        usedCredit: 300,
      };

      const result = processPurchase(account, 600);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0); // Balance depleted
      expect(result.newUsedCredit).toBe(400); // Credit increased by 100
      expect(result.availableAfter).toBe(600);
    });
  });

  describe('Regression: Double-counting bug', () => {
    it('should NOT double-count purchase in available balance', () => {
      const account: AccountState = {
        balance: 5000,
        creditLine: 5000,
        usedCredit: 0,
      };

      const availableBefore = account.balance + (account.creditLine - account.usedCredit);
      const result = processPurchase(account, 10);

      expect(result.success).toBe(true);

      // The key assertion: available should decrease by EXACTLY the purchase amount
      const availableDecrease = availableBefore - result.availableAfter!;
      expect(availableDecrease).toBe(10);

      // NOT 20 (which was the bug)
      expect(availableDecrease).not.toBe(20);

      // Verify the math
      expect(result.availableAfter).toBe(9990);
    });
  });
});
