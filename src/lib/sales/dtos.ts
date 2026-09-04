import { Sale, SaleItem } from '@/generated/prisma/client';

export type SaleWithItems = Sale & {
  items?: SaleItem[];
};

export type SafeSaleDTO = Omit<Sale, 'createdById' | 'updatedAt'> & {
  items?: Omit<SaleItem, 'saleId'>[];
};

export function toSafeSaleDTO(sale: SaleWithItems): SafeSaleDTO {
  const { createdById: _createdById, updatedAt: _updatedAt, items, ...rest } = sale;
  return {
    ...rest,
    items: items?.map(({ saleId: _saleId, ...itemRest }) => itemRest),
  };
}
