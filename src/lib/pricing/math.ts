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
 * Calculates the exact line total after applying the discount.
 * @param lineSubtotal The subtotal of the line
 * @param discount The flat monetary discount amount to subtract
 * @returns The total (subtotal - discount), ensuring it does not drop below zero
 */
export function calculateLineTotal(
  lineSubtotal: Decimal | number | string,
  discount: Decimal | number | string
): Decimal {
  const subtotal = new Decimal(lineSubtotal);
  const discountAmount = new Decimal(discount);

  const total = subtotal.sub(discountAmount);
  return total.isNegative() ? new Decimal(0) : total;
}

/**
 * Calculates the exact total for a document containing items.
 * @param items Array of items containing line totals
 * @returns The sum of all line totals
 */
export function calculateDocumentSubtotal(
  items: { total: Decimal | number | string }[]
): Decimal {
  return items.reduce(
    (sum, item) => sum.add(new Decimal(item.total)),
    new Decimal(0)
  );
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
