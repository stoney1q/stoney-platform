'use server';

import { revalidatePath } from 'next/cache';
import prisma from '../prisma';
import {
  requirePermission,
  assertCanAssignRole,
  assertCanAssignBranch,
} from '../auth/guard';
import { provisionStaffSchema, updateStaffSchema } from './validation';

export async function getStaff() {
  const user = await requirePermission('users:read');

  const whereClause =
    user.permissions.includes('admin:global') ||
    user.role.name === 'Super Admin'
      ? {}
      : { branchId: user.branchId };

  const staff = await prisma.user.findMany({
    where: whereClause,
    include: {
      role: true,
      branch: true,
    },
    orderBy: [{ branch: { name: 'asc' } }, { firstName: 'asc' }],
  });

  return staff;
}

export async function getRolesForAssignment() {
  await requirePermission('users:read');
  // Return all roles. The frontend might filter out ones the user can't assign,
  // but the backend will strictly enforce it in the actions.
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  });
  return roles;
}

export async function provisionStaff(formData: FormData) {
  const user = await requirePermission('users:create');

  const rawData = {
    email: formData.get('email') as string,
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    roleId: formData.get('roleId') as string,
    branchId: formData.get('branchId') as string,
  };

  const parsed = provisionStaffSchema.parse(rawData);

  // Escalate checks
  await assertCanAssignRole(user, parsed.roleId);
  await assertCanAssignBranch(user, parsed.branchId);

  const existing = await prisma.user.findUnique({
    where: { email: parsed.email },
  });

  if (existing) {
    throw new Error('A user with this email already exists');
  }

  const staff = await prisma.user.create({
    data: {
      email: parsed.email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      roleId: parsed.roleId,
      branchId: parsed.branchId,
      isActive: true,
      emailVerified: false,
    },
  });

  revalidatePath('/settings/staff');
  return staff;
}

export async function updateStaff(formData: FormData) {
  const user = await requirePermission('users:update');

  const rawData = {
    userId: formData.get('userId') as string,
    email: formData.get('email') as string,
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    roleId: formData.get('roleId') as string,
    branchId: formData.get('branchId') as string,
    isActive: formData.get('isActive') === 'true',
  };

  const parsed = updateStaffSchema.parse(rawData);

  if (parsed.userId === user.id) {
    throw new Error('You cannot modify your own role, branch, or status');
  }

  // Enforce isolation against the target user's existing branch!
  // If they are in HQ, a Manager from 'Other' shouldn't be able to edit them.
  const existingUser = await prisma.user.findUnique({
    where: { id: parsed.userId },
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  await assertCanAssignBranch(user, existingUser.branchId);

  // Escalate checks for new assignments
  await assertCanAssignRole(user, parsed.roleId);
  await assertCanAssignBranch(user, parsed.branchId);

  const emailConflict = await prisma.user.findUnique({
    where: { email: parsed.email },
  });

  if (emailConflict && emailConflict.id !== parsed.userId) {
    throw new Error('This email is already in use by another user');
  }

  const staff = await prisma.user.update({
    where: { id: parsed.userId },
    data: {
      email: parsed.email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      roleId: parsed.roleId,
      branchId: parsed.branchId,
      isActive: parsed.isActive,
    },
  });

  revalidatePath('/settings/staff');
  return staff;
}
