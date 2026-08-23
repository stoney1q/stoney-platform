import { z } from 'zod';
import { RepairStatus } from '@/generated/prisma/client';

export const createRepairSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  deviceId: z.string().min(1, 'Device is required'),
  issue: z.string().min(1, 'Issue description is required'),
  notes: z.string().optional(),
});

export const updateRepairStatusSchema = z.object({
  repairId: z.string().min(1, 'Repair ID is required'),
  status: z.nativeEnum(RepairStatus),
  notes: z.string().optional(),
  version: z.number().int().positive(),
});

export const assignTechnicianSchema = z.object({
  repairId: z.string().min(1, 'Repair ID is required'),
  technicianId: z.string().nullable(),
  version: z.number().int().positive(),
});

export const planRepairPartSchema = z.object({
  repairId: z.string().min(1, 'Repair ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  plannedQuantity: z
    .number()
    .int()
    .min(0, 'Planned quantity must be non-negative'),
  version: z.number().int().positive(),
});

export const consumeRepairPartSchema = z.object({
  repairId: z.string().min(1, 'Repair ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  version: z.number().int().positive(),
});

export const returnRepairPartSchema = z.object({
  repairId: z.string().min(1, 'Repair ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  version: z.number().int().positive(),
});

export const cancelRepairSchema = z.object({
  repairId: z.string().min(1, 'Repair ID is required'),
  version: z.number().int().positive(),
});

export const createDeviceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const updateDeviceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});
