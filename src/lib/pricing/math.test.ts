import 'dotenv/config';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import { Decimal } from 'decimal.js';
import {
  calculateLineSubtotal,
  calculateLineTotal,
  calculateLineTax,
  calculateDocumentSubtotal,
  calculateDocumentTax,
  calculateDocumentTotal,
  isValidDiscount,
} from './math';

describe('Pricing Math Utilities', () => {
  describe('calculateLineSubtotal', () => {
    it('should correctly calculate subtotal for simple numbers', () => {
      const result = calculateLineSubtotal(10.5, 2);
      assert.strictEqual(result.toString(), '21');
    });

    it('should handle decimal precision correctly without floating point errors', () => {
      // 0.1 * 3 in JS is 0.30000000000000004
      const result = calculateLineSubtotal(0.1, 3);
      assert.strictEqual(result.toString(), '0.3');
    });

    it('should accept strings, numbers, and Decimal inputs', () => {
      assert.strictEqual(calculateLineSubtotal('15.99', 2).toString(), '31.98');
      assert.strictEqual(calculateLineSubtotal(15.99, 2).toString(), '31.98');
      assert.strictEqual(
        calculateLineSubtotal(new Decimal(15.99), 2).toString(),
        '31.98'
      );
    });
  });

  describe('calculateLineTotal', () => {
    it('should subtract discount from subtotal and add tax', () => {
      const result = calculateLineTotal(100, 15, 5);
      assert.strictEqual(result.toString(), '90'); // 100 - 15 + 5
    });

    it('should return tax if discount is greater than subtotal', () => {
      const result = calculateLineTotal(100, 150, 10);
      assert.strictEqual(result.toString(), '10'); // 0 + 10
    });

    it('should handle floating point math exactly', () => {
      const result = calculateLineTotal(0.3, 0.2, 0.05);
      assert.strictEqual(result.toString(), '0.15');
    });
  });

  describe('calculateLineTax', () => {
    it('should correctly calculate line tax', () => {
      const result = calculateLineTax(100, 0.2);
      assert.strictEqual(result.toString(), '20');
    });
  });

  describe('calculateDocumentSubtotal', () => {
    it('should sum up all line subtotals exactly', () => {
      const items = [
        { subtotal: 10.5 },
        { subtotal: '20.25' },
        { subtotal: new Decimal(5.1) },
      ];

      const result = calculateDocumentSubtotal(items);
      assert.strictEqual(result.toString(), '35.85');
    });

    it('should return 0 for an empty array', () => {
      const result = calculateDocumentSubtotal([]);
      assert.strictEqual(result.toString(), '0');
    });
  });

  describe('calculateDocumentTax', () => {
    it('should sum up all line tax exactly', () => {
      const items = [
        { taxAmount: 1.5 },
        { taxAmount: '2.25' },
        { taxAmount: new Decimal(1.1) },
      ];

      const result = calculateDocumentTax(items);
      assert.strictEqual(result.toString(), '4.85');
    });
  });

  describe('calculateDocumentTotal', () => {
    it('should exactly calculate document total using the sum of line totals, minus document discount', () => {
      const items = [
        // Subtotal = 100, Item Discount = 10, Tax = 5 -> Line Total = 95
        { subtotal: 100, discount: 10, taxAmount: 5 },
        // Subtotal = 50, Item Discount = 0, Tax = 2 -> Line Total = 52
        { subtotal: 50, discount: 0, taxAmount: 2 },
      ];
      // Sum of line totals = 147
      // Document discount = 20
      // Final = 127
      const result = calculateDocumentTotal(items, 20);
      assert.strictEqual(result.toString(), '127');
    });

    it('should floor document total at 0', () => {
      const items = [{ subtotal: 100, discount: 0, taxAmount: 0 }];
      // Line Total = 100. Doc discount = 150. Floor at 0.
      const result = calculateDocumentTotal(items, 150);
      assert.strictEqual(result.toString(), '0');
    });

    it('should process correctly when there is no document discount', () => {
      const items = [{ subtotal: 100, discount: 10, taxAmount: 5 }];
      const result = calculateDocumentTotal(items);
      assert.strictEqual(result.toString(), '95');
    });
  });

  describe('isValidDiscount', () => {
    it('should return true if discount is strictly less than subtotal', () => {
      assert.strictEqual(isValidDiscount(100, 50), true);
    });

    it('should return true if discount equals subtotal', () => {
      assert.strictEqual(isValidDiscount(100, 100), true);
    });

    it('should return false if discount is greater than subtotal', () => {
      assert.strictEqual(isValidDiscount(100, 101), false);
    });

    it('should return false if discount is negative', () => {
      assert.strictEqual(isValidDiscount(100, -10), false);
    });
  });
});
