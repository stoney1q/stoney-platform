'use server';

import prisma from '../prisma';
import { requirePermission } from '../auth/guard';

// ==========================================
// CATEGORY ACTIONS
// ==========================================

export async function getCategories() {
  await requirePermission('products:read');
  return await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(data: { name: string }) {
  await requirePermission('products:create');

  const name = data.name.trim();
  if (!name) throw new Error('Category name is required');

  try {
    return await prisma.category.create({
      data: { name },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.code === 'P2002') {
      throw new Error('A category with this name already exists');
    }
    throw e;
  }
}

export async function updateCategory(id: string, data: { name: string }) {
  await requirePermission('products:update');

  const name = data.name.trim();
  if (!name) throw new Error('Category name is required');

  try {
    return await prisma.category.update({
      where: { id },
      data: { name },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.code === 'P2002') {
      throw new Error('A category with this name already exists');
    }
    throw e;
  }
}

export async function deleteCategory(id: string) {
  await requirePermission('products:delete');

  try {
    return await prisma.category.delete({
      where: { id },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (
      e.code === 'P2003' ||
      (e.code === 'P2039' && e.message?.includes('23001'))
    ) {
      throw new Error(
        'Cannot delete category because it is assigned to one or more products'
      );
    }
    throw e;
  }
}

// ==========================================
// BRAND ACTIONS
// ==========================================

export async function getBrands() {
  await requirePermission('products:read');
  return await prisma.brand.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function createBrand(data: { name: string }) {
  await requirePermission('products:create');

  const name = data.name.trim();
  if (!name) throw new Error('Brand name is required');

  try {
    return await prisma.brand.create({
      data: { name },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.code === 'P2002') {
      throw new Error('A brand with this name already exists');
    }
    throw e;
  }
}

export async function updateBrand(id: string, data: { name: string }) {
  await requirePermission('products:update');

  const name = data.name.trim();
  if (!name) throw new Error('Brand name is required');

  try {
    return await prisma.brand.update({
      where: { id },
      data: { name },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.code === 'P2002') {
      throw new Error('A brand with this name already exists');
    }
    throw e;
  }
}

export async function deleteBrand(id: string) {
  await requirePermission('products:delete');

  try {
    return await prisma.brand.delete({
      where: { id },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (
      e.code === 'P2003' ||
      (e.code === 'P2039' && e.message?.includes('23001'))
    ) {
      throw new Error(
        'Cannot delete brand because it is assigned to one or more products'
      );
    }
    throw e;
  }
}
