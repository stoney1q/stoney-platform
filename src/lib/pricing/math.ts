import { Decimal } from 'decimal.js';

/**
 * Calculates the exact line subtotal.
 * @param unitPrice The unit price of the item
 * @param quantity The quantity of the item
 * @returns The subtotal (unitPrice * quantity)
 */
export function calculateLineSubtotal(
  unitPrice: Decimal | number | string,
  quantity: number
): Decimal {
  const price = new Decimal(unitPrice);
  return price.mul(quantity);
}

/**
 * Calculates the exact line tax amount.
 * @param lineSubtotal The subtotal of the line after line discounts
 * @param taxRate The decimal tax rate (e.g. 0.20 for 20%)
 * @returns The tax amount (lineSubtotal * taxRate)
 */
export function calculateLineTax(
  lineSubtotal: Decimal | number | string,
  taxRate: Decimal | number | string
): Decimal {
  const subtotal = new Decimal(lineSubtotal);
  const rate = new Decimal(taxRate);
  return subtotal.mul(rate);
}

/**
 * Calculates the exact line total after applying the discount and adding tax.
 * @param lineSubtotal The subtotal of the line
 * @param discount The flat monetary discount amount to subtract
 * @param taxAmount The calculated tax amount for the line
 * @returns The total (subtotal - discount + taxAmount), ensuring subtotal-discount >= 0
 */
export function calculateLineTotal(
  lineSubtotal: Decimal | number | string,
  discount: Decimal | number | string,
  taxAmount: Decimal | number | string = 0
): Decimal {
  const subtotal = new Decimal(lineSubtotal);
  const discountAmount = new Decimal(discount);
  const tax = new Decimal(taxAmount);

  const discounted = subtotal.sub(discountAmount);
  const base = discounted.isNegative() ? new Decimal(0) : discounted;
  return base.add(tax);
}

/**
 * Calculates the exact total for a document containing items.
 * @param items Array of items containing line totals
 * @returns The sum of all line totals
 */
export function calculateDocumentSubtotal(
  items: {
    subtotal: Decimal | number | string;
    discount?: Decimal | number | string;
  }[]
): Decimal {
  return items.reduce((sum, item) => {
    const s = new Decimal(item.subtotal);
    const d = item.discount ? new Decimal(item.discount) : new Decimal(0);
    return sum.add(s.sub(d));
  }, new Decimal(0));
}

export function calculateDocumentTax(
  items: { taxAmount: Decimal | number | string }[]
): Decimal {
  return items.reduce(
    (sum, item) => sum.add(new Decimal(item.taxAmount)),
    new Decimal(0)
  );
}

/**
 * Calculates the document final total.
 * @param items Array of items containing line subtotals, discounts, and taxes.
 * @param documentDiscount The document-level discount to apply to the net total.
 * @returns The final document total: Sum(Line Total) - Document Discount
 */
export function calculateDocumentTotal(
  items: {
    subtotal: Decimal | number | string;
    discount: Decimal | number | string;
    taxAmount: Decimal | number | string;
  }[],
  documentDiscount: Decimal | number | string = 0
): Decimal {
  const lineTotalsSum = items.reduce((sum, item) => {
    return sum.add(
      calculateLineTotal(item.subtotal, item.discount, item.taxAmount)
    );
  }, new Decimal(0));

  const docDiscount = new Decimal(documentDiscount);
  const finalTotal = lineTotalsSum.sub(docDiscount);

  return finalTotal.isNegative() ? new Decimal(0) : finalTotal;
}

/**
 * Validates that a discount is reasonable (e.g. not greater than the subtotal, not negative).
 * @param subtotal The subtotal to discount
 * @param discount The discount amount
 * @returns True if discount <= subtotal and discount >= 0
 */
export function isValidDiscount(
  subtotal: Decimal | number | string,
  discount: Decimal | number | string
): boolean {
  return (
    new Decimal(discount).lte(new Decimal(subtotal)) &&
    new Decimal(discount).gte(0)
  );
}
