import { requirePermission, requireAuth } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import CreatePurchaseOrderForm from './create-form';

export default async function NewPurchaseOrderPage() {
  const user = await requireAuth();
  await requirePermission('purchases:write');

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
  });

  const productSuppliers = await prisma.productSupplier.findMany({
    include: {
      product: true,
    },
  });

  // Map supplier ID to their available products
  const productsBySupplier = productSuppliers.reduce(
    (acc, ps) => {
      if (!acc[ps.supplierId]) {
        acc[ps.supplierId] = [];
      }
      acc[ps.supplierId].push({
        id: ps.product.id,
        name: ps.product.name,
        sku: ps.product.sku,
        unitCost: ps.unitCost.toNumber(),
      });
      return acc;
    },
    {} as Record<
      string,
      Array<{ id: string; name: string; sku: string; unitCost: number }>
    >
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Create Purchase Order
        </h2>
        <p className="text-muted-foreground">
          Draft a new purchase order for a supplier.
        </p>
      </div>

      <CreatePurchaseOrderForm
        branchId={user.branchId}
        suppliers={suppliers}
        productsBySupplier={productsBySupplier}
      />
    </div>
  );
}
