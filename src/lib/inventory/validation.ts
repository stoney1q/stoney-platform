import { z } from 'zod';

export const receiveStockSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than zero'),
  supplierId: z.string().optional(),
});

export const adjustStockSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .refine((val) => val !== 0, 'Quantity cannot be zero'),
  reason: z.string().min(3, 'A descriptive reason is required for adjustments'),
});
