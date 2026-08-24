'use server';

import { revalidatePath } from 'next/cache';
import prisma from '../prisma';
import { requirePermission } from '../auth/guard';
import { createBranchSchema, updateBranchSchema } from './validation';

export async function getBranches() {
  await requirePermission('branches:read');
  const branches = await prisma.branch.findMany({
    orderBy: { name: 'asc' },
  });
  return branches;
}

export async function listDestinationBranches() {
  // To allow inter-branch transfers, users with transfers:write can list basic branch info
  // Alternatively, branches:read covers it.
  try {
    await requirePermission('branches:read');
  } catch {
    // If they don't have branches:read, maybe they have transfers:write
    await requirePermission('transfers:write');
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  return branches;
}

export async function createBranch(formData: FormData) {
  await requirePermission('branches:create');

  const rawData = {
    name: formData.get('name') as string,
    code: formData.get('code') as string,
    address: (formData.get('address') as string) || undefined,
    isActive: formData.get('isActive') === 'true',
  };

  const parsed = createBranchSchema.parse(rawData);

  // Enforce unique code
  const existing = await prisma.branch.findUnique({
    where: { code: parsed.code },
  });

  if (existing) {
    throw new Error('Branch code must be unique');
  }

  const branch = await prisma.branch.create({
    data: parsed,
  });

  revalidatePath('/settings/branches');
  return branch;
}

export async function updateBranch(formData: FormData) {
  await requirePermission('branches:update');

  const rawData = {
    branchId: formData.get('branchId') as string,
    name: formData.get('name') as string,
    code: formData.get('code') as string,
    address: (formData.get('address') as string) || undefined,
    isActive: formData.get('isActive') === 'true',
  };

  const parsed = updateBranchSchema.parse(rawData);

  const existing = await prisma.branch.findUnique({
    where: { code: parsed.code },
  });

  if (existing && existing.id !== parsed.branchId) {
    throw new Error('Branch code is already in use by another branch');
  }

  const branch = await prisma.branch.update({
    where: { id: parsed.branchId },
    data: {
      name: parsed.name,
      code: parsed.code,
      address: parsed.address,
      isActive: parsed.isActive,
    },
  });

  revalidatePath('/settings/branches');
  return branch;
}
