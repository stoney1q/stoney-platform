import { z } from 'zod';

export const storeSettingsSchema = z.object({
  currencyCode: z.string().min(1, 'Currency code is required').max(10),
  currencySymbol: z.string().min(1, 'Currency symbol is required').max(10),
  taxRegistration: z.string().nullable().optional(),
  receiptFooter: z.string().nullable().optional(),
});

export const taxRateSchema = z.object({
  name: z.string().min(1, 'Tax rate name is required'),
  rate: z.coerce
    .number()
    .min(0, 'Rate cannot be negative')
    .max(1, 'Rate cannot exceed 100% (1.00)'),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export type StoreSettingsFormValues = z.infer<typeof storeSettingsSchema>;
export type TaxRateFormValues = z.infer<typeof taxRateSchema>;
