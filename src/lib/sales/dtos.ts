import {
  Sale,
  SaleItem,
  Payment,
  Customer,
  Prisma,
} from '@/generated/prisma/client';

export type SaleWithRelations = Sale & {
  items?: SaleItem[];
  payments?: Payment[];
  customer?: Customer;
};

export type SaleWithItems = SaleWithRelations;

export type SafePaymentDTO = Omit<Payment, 'createdById'>;

export type SafeSaleDTO = Omit<Sale, 'createdById' | 'updatedAt'> & {
  items?: Omit<SaleItem, 'saleId'>[];
  payments?: SafePaymentDTO[];
  customer?: Customer;
  totalPaid?: string;
  balanceDue?: string;
};

export function toSafeSaleDTO(sale: SaleWithRelations): SafeSaleDTO {
  const {
    createdById: _createdById,
    updatedAt: _updatedAt,
    items,
    payments,
    customer,
    ...rest
  } = sale;

  let totalPaidDecimal = new Prisma.Decimal(0);
  const safePayments = payments?.map(
    ({ createdById: _createdById, ...payRest }) => {
      totalPaidDecimal = totalPaidDecimal.add(
        new Prisma.Decimal(payRest.amount)
      );
      return payRest;
    }
  );

  const totalDecimal = new Prisma.Decimal(sale.total || 0);
  const balanceDueDecimal = totalDecimal.minus(totalPaidDecimal);
  const balanceDue = balanceDueDecimal.greaterThan(0)
    ? balanceDueDecimal.toFixed(2)
    : '0.00';

  return {
    ...rest,
    items: items?.map(({ saleId: _saleId, ...itemRest }) => itemRest),
    payments: safePayments,
    customer,
    totalPaid: payments ? totalPaidDecimal.toFixed(2) : undefined,
    balanceDue: payments ? balanceDue : undefined,
  };
}
