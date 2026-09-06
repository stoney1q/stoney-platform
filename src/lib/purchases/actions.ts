'use server';

import {
  requireBranchAccess,
  requirePermission,
  requireAuth,
} from '@/lib/auth/guard';
import * as service from './service';
import {
  CreatePurchaseOrderValues,
  ReceivePurchaseOrderValues,
  UpdatePurchaseOrderValues,
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from './validation';
import prisma from '@/lib/prisma';

function handleActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Purchase Order action error:', message);
  return { success: false as const, error: message, data: undefined };
}

export async function getPurchaseOrders(page = 1, limit = 50) {
  try {
    const user = await requireAuth();
    await requirePermission('purchases:read');
    const result = await service.getPurchaseOrders(user.branchId, page, limit);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getPurchaseOrder(id: string) {
  try {
    const user = await requireAuth();
    await requirePermission('purchases:read');

    const po = await service.getPurchaseOrder(id);
    if (!po) throw new Error('Purchase Order not found');
    await requireBranchAccess(po.branchId);

    return { success: true as const, data: po, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function createPurchaseOrder(data: CreatePurchaseOrderValues) {
  try {
    const user = await requireAuth();
    await requireBranchAccess(data.branchId);
    await requirePermission('purchases:write');

    const parsed = createPurchaseOrderSchema.parse(data);
    const result = await service.createPurchaseOrder(user.id, parsed);

    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function markPurchaseOrderOrdered(id: string) {
  try {
    const user = await requireAuth();
    await requirePermission('purchases:write');

    // Need to verify branch access before mutating
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('Purchase Order not found');
    await requireBranchAccess(po.branchId);

    const result = await service.markPurchaseOrderOrdered(id);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function receivePurchaseOrder(
  id: string,
  data: ReceivePurchaseOrderValues
) {
  try {
    const user = await requireAuth();
    await requirePermission('purchases:write');

    const parsed = receivePurchaseOrderSchema.parse(data);

    // Verify branch access
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('Purchase Order not found');
    await requireBranchAccess(po.branchId);

    const result = await service.receivePurchaseOrder(id, user.id, parsed);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function cancelPurchaseOrder(id: string) {
  try {
    const user = await requireAuth();
    await requirePermission('purchases:write');

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('Purchase Order not found');
    await requireBranchAccess(po.branchId);

    const result = await service.cancelPurchaseOrder(id);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}
