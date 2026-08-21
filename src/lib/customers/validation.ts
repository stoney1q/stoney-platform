import { z } from 'zod';

export const customerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z
      .string()
      .email('Invalid email address')
      .optional()
      .or(z.literal('')),
    phone: z
      .string()
      .min(7, 'Phone number must be at least 7 characters')
      .max(20, 'Phone number must be at most 20 characters')
      .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
      .optional()
      .or(z.literal('')),
    alternatePhone: z
      .string()
      .min(7, 'Phone number must be at least 7 characters')
      .max(20, 'Phone number must be at most 20 characters')
      .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format')
      .optional()
      .or(z.literal('')),
    address: z
      .string()
      .max(500, 'Address is too long')
      .optional()
      .or(z.literal('')),
    isActive: z.boolean(),
  })
  .refine(
    (data) =>
      (data.email && data.email.trim() !== '') ||
      (data.phone && data.phone.trim() !== ''),
    {
      message: 'Either email or phone is required',
      path: ['phone'],
    }
  );

export type CustomerFormValues = z.infer<typeof customerSchema>;
