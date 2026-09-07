'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { storeSettingsSchema, taxRateSchema } from './validation';

export async function getStoreSettings() {
  await requirePermission('admin:global');

  let settings = await prisma.storeSettings.findUnique({
    where: { id: 'global' },
  });

  if (!settings) {
    settings = await prisma.storeSettings.create({
      data: {
        id: 'global',
        currencyCode: 'USD',
        currencySymbol: '$',
      },
    });
  }

  return settings;
}

export async function getPublicStoreSettings() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: 'global' },
  });

  return (
    settings || {
      currencyCode: 'USD',
      currencySymbol: '$',
      taxRegistration: null,
      receiptFooter: null,
    }
  );
}

export async function updateStoreSettings(formData: FormData) {
  await requirePermission('admin:global');

  const rawData = {
    currencyCode: formData.get('currencyCode'),
    currencySymbol: formData.get('currencySymbol'),
    taxRegistration: formData.get('taxRegistration') || null,
    receiptFooter: formData.get('receiptFooter') || null,
  };

  const data = storeSettingsSchema.parse(rawData);

  const updated = await prisma.storeSettings.upsert({
    where: { id: 'global' },
    update: data,
    create: {
      id: 'global',
      ...data,
    },
  });

  revalidatePath('/settings/general');
  return updated;
}

export async function getTaxRates() {
  await requirePermission('admin:global');
  return prisma.taxRate.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTaxRate(formData: FormData) {
  await requirePermission('admin:global');

  const rawData = {
    name: formData.get('name'),
    rate: formData.get('rate'),
    isActive: formData.get('isActive') === 'true',
    isDefault: formData.get('isDefault') === 'true',
  };

  const data = taxRateSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      // Lock table in Share Row Exclusive Mode to prevent concurrent modifications
      await tx.$executeRaw`LOCK TABLE "TaxRate" IN SHARE ROW EXCLUSIVE MODE`;
      await tx.taxRate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.taxRate.create({
      data,
    });

    revalidatePath('/settings/taxes');
    return created;
  });
}

export async function updateTaxRate(id: string, formData: FormData) {
  await requirePermission('admin:global');

  const rawData = {
    name: formData.get('name'),
    rate: formData.get('rate'),
    isActive: formData.get('isActive') === 'true',
    isDefault: formData.get('isDefault') === 'true',
  };

  const data = taxRateSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      // Lock table in Share Row Exclusive Mode to prevent concurrent modifications
      await tx.$executeRaw`LOCK TABLE "TaxRate" IN SHARE ROW EXCLUSIVE MODE`;
      await tx.taxRate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.taxRate.update({
      where: { id },
      data,
    });

    revalidatePath('/settings/taxes');
    return updated;
  });
}

export async function deleteTaxRate(id: string) {
  await requirePermission('admin:global');

  const rate = await prisma.taxRate.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!rate) throw new Error('Tax rate not found');

  if (rate._count.products > 0) {
    throw new Error('Cannot delete tax rate currently assigned to products.');
  }

  await prisma.taxRate.delete({
    where: { id },
  });

  revalidatePath('/settings/taxes');
}
