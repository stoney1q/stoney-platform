import { z } from 'zod';
import { QuotationStatus } from '@/generated/prisma/client';

export const createQuotationSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  branchId: z.string().optional(),
});

export const addQuotationItemSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
});

export const removeQuotationItemSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
  quotationItemId: z.string().min(1, 'Item ID is required'),
});

export const updateQuotationStatusSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
  status: z.nativeEnum(QuotationStatus),
});

export const convertQuotationToSaleSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
});
