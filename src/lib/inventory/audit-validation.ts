import { z } from 'zod';
import { StockAuditStatus } from '../../generated/prisma/client';

export const createAuditSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  name: z.string().optional(),
});

export const updateAuditStatusSchema = z.object({
  auditId: z.string().min(1, 'Audit ID is required'),
  status: z.nativeEnum(StockAuditStatus),
});

export const upsertAuditItemSchema = z.object({
  auditId: z.string().min(1, 'Audit ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(0, 'Quantity must be at least 0'),
  mode: z.enum(['set', 'increment']).default('set'),
});
