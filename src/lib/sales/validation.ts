import { z } from 'zod';
import { PaymentMethod } from '@/generated/prisma/client';

export const moneySchema = z.coerce
  .number()
  .min(0, 'Amount must be a non-negative value');

export const createSaleSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
});

export const addSaleItemSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than zero'),
  discount: moneySchema.default(0),
});

export const removeSaleItemSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  saleItemId: z.string().min(1, 'Sale Item ID is required'),
});

export const applyPaymentSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  method: z.nativeEnum(PaymentMethod, {
    message: 'Invalid payment method',
  }),
  reference: z.string().optional(),
});

export const cancelSaleSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
});
