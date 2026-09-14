import { z } from 'zod';

export const emailDocumentSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  documentType: z.enum(['SALE', 'QUOTATION', 'REPAIR']),
  email: z.string().email('Valid email is required'),
});

export const crossBranchLookupSchema = z.object({
  documentNumber: z.string().min(1, 'Document number is required'),
  verificationFactor: z.string().min(1, 'Verification factor is required'), // e.g., email or last 4 digits
});

export type EmailDocumentInput = z.infer<typeof emailDocumentSchema>;
export type CrossBranchLookupInput = z.infer<typeof crossBranchLookupSchema>;
