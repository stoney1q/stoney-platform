import prisma from '../prisma';
import { Prisma } from '../../generated/prisma/client';
import { SupplierFormValues, LinkProductSupplierValues } from './validation';
import { requirePermission } from '../auth/guard';

export async function createSupplier(data: SupplierFormValues) {
  await requirePermission('suppliers:create');
  return await prisma.supplier.create({ data });
}

export async function updateSupplier(id: string, data: SupplierFormValues) {
  await requirePermission('suppliers:update');
  return await prisma.supplier.update({ where: { id }, data });
}

export async function deleteSupplier(id: string) {
  await requirePermission('suppliers:delete');
  return await prisma.supplier.delete({ where: { id } });
}

export async function getSupplier(id: string) {
  await requirePermission('suppliers:read');
  return await prisma.supplier.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function searchSuppliers(args: {
  query?: string;
  page?: number;
  limit?: number;
}) {
  await requirePermission('suppliers:read');
  const { query = '', page = 1, limit = 10 } = args;

  const where: Prisma.SupplierWhereInput = {};

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { contactName: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ];
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.supplier.count({ where }),
  ]);

  return {
    suppliers,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function linkProductToSupplier(data: LinkProductSupplierValues) {
  await requirePermission('suppliers:update');

  if (data.isPreferred) {
    return await prisma.$transaction(async (tx) => {
      await tx.productSupplier.updateMany({
        where: { productId: data.productId },
        data: { isPreferred: false },
      });

      return await tx.productSupplier.upsert({
        where: {
          productId_supplierId: {
            productId: data.productId,
            supplierId: data.supplierId,
          },
        },
        create: data,
        update: {
          supplierSku: data.supplierSku,
          unitCost: data.unitCost,
          isPreferred: true,
        },
      });
    });
  }

  return await prisma.productSupplier.upsert({
    where: {
      productId_supplierId: {
        productId: data.productId,
        supplierId: data.supplierId,
      },
    },
    create: data,
    update: {
      supplierSku: data.supplierSku,
      unitCost: data.unitCost,
      isPreferred: data.isPreferred,
    },
  });
}

export async function unlinkProductFromSupplier(
  productId: string,
  supplierId: string
) {
  await requirePermission('suppliers:update');
  return await prisma.productSupplier.delete({
    where: {
      productId_supplierId: { productId, supplierId },
    },
  });
}
