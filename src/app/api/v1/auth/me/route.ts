import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/handler';
import { requireAuth } from '@/lib/auth/guard';

export const GET = apiHandler(async () => {
  const user = await requireAuth();

  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        branchId: user.branchId,
        branch: {
          id: user.branch.id,
          code: user.branch.code,
          name: user.branch.name,
          isActive: user.branch.isActive,
        },
        role: {
          id: user.role.id,
          name: user.role.name,
        },
        permissions: user.permissions,
      },
    },
  });
});
