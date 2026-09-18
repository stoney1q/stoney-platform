'use server';

import { CustomerFormValues } from './validation';
import * as service from './service';
import { CustomerDuplicateWarning } from './service';
import { logger } from '@/lib/observability/logger';

function handleActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('Customer action error', error);
  return {
    success: false as const,
    error: message,
    data: undefined,
    warning: undefined,
  };
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

export async function updateCustomer(id: string, data: CustomerFormValues) {
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
