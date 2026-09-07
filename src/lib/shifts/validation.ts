import { z } from 'zod';
import { CashMovementType } from '@/generated/prisma/client';
import { moneySchema } from '@/lib/sales/validation';

export const openShiftSchema = z.object({
  openingBalance: moneySchema,
  notes: z.string().max(500).optional(),
});

export const closeShiftSchema = z.object({
  shiftId: z.string().cuid('Invalid shift ID'),
  closingBalance: moneySchema,
  notes: z.string().max(500).optional(),
});

export const addCashMovementSchema = z.object({
  shiftId: z.string().cuid('Invalid shift ID'),
  type: z.nativeEnum(CashMovementType),
  amount: moneySchema,
  reason: z.string().min(3, 'Reason is required').max(200),
});
