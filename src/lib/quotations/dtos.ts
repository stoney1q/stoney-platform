import { Quotation, QuotationItem } from '@/generated/prisma/client';

export type QuotationWithItems = Quotation & {
  items?: QuotationItem[];
};

export type SafeQuotationDTO = Omit<Quotation, 'createdById' | 'updatedAt'> & {
  items?: Omit<QuotationItem, 'quotationId'>[];
};

export function toSafeQuotationDTO(quotation: QuotationWithItems): SafeQuotationDTO {
  const { createdById: _createdById, updatedAt: _updatedAt, items, ...rest } = quotation;
  return {
    ...rest,
    items: items?.map(({ quotationId: _quotationId, ...itemRest }) => itemRest),
  };
}
