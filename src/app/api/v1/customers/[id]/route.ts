import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import * as customerService from '@/lib/customers/service';
import { customerSchema } from '@/lib/customers/validation';

import { Customer } from '@/generated/prisma/client';

function toSafeCustomerDTO(customer: Customer) {
  if (!customer) return customer;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createdById, sequence, ...safe } = customer;
  return safe;
}

export const GET = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;
  const result = await customerService.getCustomer(id);

  if (!result.data) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ data: toSafeCustomerDTO(result.data) });
});

export const PUT = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;
  const body = await req.json();
  const data = customerSchema.parse(body);

  const result = await customerService.updateCustomer(id, data);

  return NextResponse.json({ data: toSafeCustomerDTO(result.data!) });
});

export const DELETE = apiHandler(async (req: NextRequest, context: unknown) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;
  await customerService.deactivateCustomer(id);

  return NextResponse.json({ data: { success: true } });
});
