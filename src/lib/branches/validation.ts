import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  code: z
    .string()
    .min(1, 'Branch code is required')
    .max(10, 'Branch code must be 10 characters or less'),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateBranchSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  name: z.string().min(1, 'Branch name is required'),
  code: z
    .string()
    .min(1, 'Branch code is required')
    .max(10, 'Branch code must be 10 characters or less'),
  address: z.string().optional(),
  isActive: z.boolean(),
});
