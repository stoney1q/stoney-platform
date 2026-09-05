import { z } from 'zod';
import { Decimal } from 'decimal.js';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  contactName: z.string().max(100).nullable().optional().or(z.literal('')),
  email: z
    .string()
    .email('Invalid email address')
    .max(100)
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z.string().max(30).nullable().optional().or(z.literal('')),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const linkProductSupplierSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  supplierSku: z.string().max(100).nullable().optional().or(z.literal('')),
  unitCost: z
    .union([z.string(), z.number()])
    .refine((val) => {
      try {
        const d = new Decimal(val);
        return d.isFinite() && d.gte(0);
      } catch {
        return false;
      }
    }, 'Unit cost must be a valid positive number')
    .transform((val) => new Decimal(val).toString()),
  isPreferred: z.boolean().default(false),
});

export type LinkProductSupplierValues = z.infer<
  typeof linkProductSupplierSchema
>;
