'use server';

import { CustomerFormValues } from './validation';
import * as service from './service';
import { CustomerDuplicateWarning } from './service';

function handleActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Customer action error:', message);
  return { success: false as const, error: message, data: undefined, warning: undefined };
}

export async function createCustomer(
  data: CustomerFormValues,
  force: boolean = false
) {
  try {
    return await service.createCustomer(data, force);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCustomer(
  id: string,
  data: CustomerFormValues
) {
  try {
    return await service.updateCustomer(id, data);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deactivateCustomer(id: string) {
  try {
    return await service.deactivateCustomer(id);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getCustomer(id: string) {
  try {
    return await service.getCustomer(id);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function searchCustomers(args: {
  query?: string;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}) {
  try {
    return await service.searchCustomers(args);
  } catch (error) {
    return handleActionError(error);
  }
}

export type { CustomerDuplicateWarning };
