'use server';

import {
  SupplierFormValues,
  LinkProductSupplierValues,
  supplierSchema,
  linkProductSupplierSchema,
} from './validation';
import * as service from './service';

function handleActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Supplier action error:', message);
  return { success: false as const, error: message, data: undefined };
}

export async function createSupplier(data: SupplierFormValues) {
  try {
    const parsed = supplierSchema.parse(data);
    const result = await service.createSupplier(parsed);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateSupplier(id: string, data: SupplierFormValues) {
  try {
    const parsed = supplierSchema.parse(data);
    const result = await service.updateSupplier(id, parsed);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteSupplier(id: string) {
  try {
    await service.deleteSupplier(id);
    return { success: true as const, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getSupplier(id: string) {
  try {
    const result = await service.getSupplier(id);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function searchSuppliers(args: {
  query?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const result = await service.searchSuppliers(args);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function linkProductToSupplier(data: LinkProductSupplierValues) {
  try {
    const parsed = linkProductSupplierSchema.parse(data);
    const result = await service.linkProductToSupplier(parsed);
    return { success: true as const, data: result, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function unlinkProductFromSupplier(
  productId: string,
  supplierId: string
) {
  try {
    await service.unlinkProductFromSupplier(productId, supplierId);
    return { success: true as const, error: undefined };
  } catch (error) {
    return handleActionError(error);
  }
}
