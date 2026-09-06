import { z } from 'zod';
import { PurchaseOrderStatus } from '@/generated/prisma/client';

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const createPurchaseOrderSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  notes: z.string().optional(),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, 'At least one item is required'),
});

export type CreatePurchaseOrderValues = z.infer<
  typeof createPurchaseOrderSchema
>;

export const updatePurchaseOrderSchema = z.object({
  notes: z.string().optional(),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, 'At least one item is required'),
});

export type UpdatePurchaseOrderValues = z.infer<
  typeof updatePurchaseOrderSchema
>;

export const receivePurchaseOrderItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(receivePurchaseOrderItemSchema)
    .min(1, 'At least one item is required to receive'),
});

export type ReceivePurchaseOrderValues = z.infer<
  typeof receivePurchaseOrderSchema
>;
