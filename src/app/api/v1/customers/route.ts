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

export const GET = apiHandler(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('query') || '';

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);

  const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));

  const activeOnly = searchParams.get('activeOnly') !== 'false';

  const result = await customerService.searchCustomers({ query, page, limit, activeOnly });

  if (result.data) {
    result.data.customers = result.data.customers.map(toSafeCustomerDTO) as unknown as Customer[];
  }

  return NextResponse.json({ data: result.data });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const data = customerSchema.parse(body);
  const searchParams = req.nextUrl.searchParams;
  const force = searchParams.get('force') === 'true';

  const result = await customerService.createCustomer(data, force);

  if (!result.success && result.warning) {
    return NextResponse.json({ warning: result.warning }, { status: 409 });
  }

  return NextResponse.json({ data: toSafeCustomerDTO(result.data!) }, { status: 201 });
});
