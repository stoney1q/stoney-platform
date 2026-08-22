import { notFound } from 'next/navigation';
import { getQuotation } from '@/lib/quotations/actions';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guard';
import { QuotationDetailsClient } from './quotation-details-client';
import {
  QuotationStatus,
  Product,
  BranchStock,
} from '@/generated/prisma/client';

export default async function QuotationDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAuth(); // just to ensure logged in
  const quotation = await getQuotation(params.id);

  if (!quotation) {
    notFound();
  }

  // Get products for the "Add Item" dropdown (MVP)
  // For Quotations, we allow both GOODS (which require stock if converted, but not strictly to quote)
  // and SERVICE. For MVP, we'll fetch all products that have stock in this branch OR are SERVICE type.
  // Actually, to keep it simple and since a quotation is just an estimate, we could fetch all active products.
  // But let's stick to the sale logic for consistency: fetch products that have branch stock in this branch.
  // Wait, SERVICE products don't have branch stock! So we must include them.
  let availableProducts: (Product & { branchStocks: BranchStock[] })[] = [];

  if (quotation.status === QuotationStatus.DRAFT) {
    availableProducts = await prisma.product.findMany({
      where: {
        OR: [
          { type: 'SERVICE' },
          {
            branchStocks: {
              some: {
                branchId: quotation.branchId,
              },
            },
          },
        ],
      },
      orderBy: { name: 'asc' },
      include: {
        branchStocks: {
          where: { branchId: quotation.branchId },
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Quotation Details</h2>
        <p className="text-muted-foreground">
          View and manage quotation QTN-
          {quotation.sequence.toString().padStart(5, '0')}
        </p>
      </div>

      <QuotationDetailsClient
        quotation={quotation}
        availableProducts={availableProducts}
      />
    </div>
  );
}
