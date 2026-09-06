import { z } from 'zod';
import { PaymentMethod, Prisma } from '@/generated/prisma/client';

export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((val) => {
    try {
      const str = val.toString();
      const decimal = new Prisma.Decimal(str);
      if (decimal.isNegative()) {
        throw new Error('Amount must be a non-negative value');
      }
      return str;
    } catch (e) {
      if (
        e instanceof Error &&
        e.message === 'Amount must be a non-negative value'
      ) {
        throw e;
      }
      throw new Error('Invalid monetary amount');
    }
  });

export const createSaleSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  branchId: z.string().optional(),
});

export const addSaleItemSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than zero'),
  discount: moneySchema.default('0'),
});

export const removeSaleItemSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  saleItemId: z.string().min(1, 'Sale Item ID is required'),
});

export const applyPaymentSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  amount: moneySchema,
  method: z.nativeEnum(PaymentMethod, {
    message: 'Invalid payment method',
  }),
  reference: z.string().optional(),
});

export const cancelSaleSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
});

export const returnSaleItemSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  saleItemId: z.string().min(1, 'Sale Item ID is required'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than zero'),
  refundAmount: moneySchema,
  refundMethod: z.nativeEnum(PaymentMethod, {
    message: 'Invalid payment method',
  }),
});
