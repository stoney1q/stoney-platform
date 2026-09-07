'use server';

import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  requireBranchAccess,
  requirePermission,
} from '@/lib/auth/guard';
import {
  openShiftSchema,
  closeShiftSchema,
  addCashMovementSchema,
} from './validation';
import {
  ShiftStatus,
  CashMovementType,
  PaymentMethod,
  Prisma,
} from '@/generated/prisma/client';
import { toSafeShiftDTO, SafeShiftDTO } from './dtos';

export async function openShift(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('sales:write');

  const rawData = {
    openingBalance: formData.get('openingBalance'),
    notes: formData.get('notes') || undefined,
  };

  const data = openShiftSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    // Check if user already has an open shift
    const existingShift = await tx.shift.findFirst({
      where: {
        userId: session.id,
        status: ShiftStatus.OPEN,
      },
    });

    if (existingShift) {
      throw new Error(
        'You already have an open shift. Please close it before opening a new one.'
      );
    }

    const shift = await tx.shift.create({
      data: {
        branchId: session.branchId,
        userId: session.id,
        openingBalance: new Prisma.Decimal(data.openingBalance),
        notes: data.notes,
        status: ShiftStatus.OPEN,
      },
    });

    return toSafeShiftDTO(shift);
  });
}

export async function closeShift(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('sales:write');

  const rawData = {
    shiftId: formData.get('shiftId'),
    closingBalance: formData.get('closingBalance'),
    notes: formData.get('notes') || undefined,
  };

  const data = closeShiftSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    // 1. Lock the shift row to prevent concurrent payments or closures
    await tx.$executeRaw`SELECT 1 FROM "Shift" WHERE id = ${data.shiftId} FOR UPDATE`;

    const shift = await tx.shift.findUniqueOrThrow({
      where: { id: data.shiftId },
      include: {
        payments: true,
        cashMovements: true,
      },
    });

    if (shift.status !== ShiftStatus.OPEN) {
      throw new Error('Shift is already closed.');
    }

    if (shift.userId !== session.id && session.role.name !== 'Super Admin') {
      throw new Error('You can only close your own shifts.');
    }

    await requireBranchAccess(shift.branchId);

    // 2. Calculate Expected Balance
    let cashPaymentsTotal = new Prisma.Decimal(0);
    for (const p of shift.payments) {
      if (p.method === PaymentMethod.CASH) {
        cashPaymentsTotal = cashPaymentsTotal.add(p.amount);
      }
    }

    let cashInTotal = new Prisma.Decimal(0);
    let cashOutTotal = new Prisma.Decimal(0);

    for (const cm of shift.cashMovements) {
      if (cm.type === CashMovementType.CASH_IN) {
        cashInTotal = cashInTotal.add(cm.amount);
      } else if (cm.type === CashMovementType.CASH_OUT) {
        cashOutTotal = cashOutTotal.add(cm.amount);
      }
    }

    const expectedBalance = shift.openingBalance
      .add(cashPaymentsTotal)
      .add(cashInTotal)
      .sub(cashOutTotal);

    const closingBalance = new Prisma.Decimal(data.closingBalance);
    const discrepancy = closingBalance.sub(expectedBalance);

    // 3. Update Shift
    const updatedShift = await tx.shift.update({
      where: { id: shift.id },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        closingBalance: closingBalance,
        expectedBalance: expectedBalance,
        discrepancy: discrepancy,
        notes: data.notes || shift.notes,
      },
    });

    return toSafeShiftDTO(updatedShift);
  });
}

export async function addCashMovement(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('sales:write');

  const rawData = {
    shiftId: formData.get('shiftId'),
    type: formData.get('type'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
  };

  const data = addCashMovementSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    // 1. Lock the shift row
    await tx.$executeRaw`SELECT 1 FROM "Shift" WHERE id = ${data.shiftId} FOR UPDATE`;

    const shift = await tx.shift.findUniqueOrThrow({
      where: { id: data.shiftId },
    });

    if (shift.status !== ShiftStatus.OPEN) {
      throw new Error('Cannot add cash movements to a closed shift.');
    }

    if (shift.userId !== session.id && session.role.name !== 'Super Admin') {
      throw new Error('You can only add cash movements to your own shift.');
    }

    await requireBranchAccess(shift.branchId);

    const movement = await tx.cashMovement.create({
      data: {
        shiftId: shift.id,
        type: data.type,
        amount: new Prisma.Decimal(data.amount),
        reason: data.reason,
        createdById: session.id,
      },
    });

    return movement;
  });
}

export async function getActiveShift(): Promise<SafeShiftDTO | null> {
  const session = await requireAuth();

  const shift = await prisma.shift.findFirst({
    where: {
      userId: session.id,
      status: ShiftStatus.OPEN,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
      },
      cashMovements: true,
      payments: true,
    },
  });

  if (!shift) {
    return null;
  }

  // Calculate current expected balance
  let cashPaymentsTotal = new Prisma.Decimal(0);
  for (const p of shift.payments) {
    if (p.method === PaymentMethod.CASH) {
      cashPaymentsTotal = cashPaymentsTotal.add(p.amount);
    }
  }

  let cashInTotal = new Prisma.Decimal(0);
  let cashOutTotal = new Prisma.Decimal(0);

  for (const cm of shift.cashMovements) {
    if (cm.type === CashMovementType.CASH_IN) {
      cashInTotal = cashInTotal.add(cm.amount);
    } else if (cm.type === CashMovementType.CASH_OUT) {
      cashOutTotal = cashOutTotal.add(cm.amount);
    }
  }

  shift.expectedBalance = shift.openingBalance
    .add(cashPaymentsTotal)
    .add(cashInTotal)
    .sub(cashOutTotal);

  return toSafeShiftDTO(shift);
}

export async function getHistoricalShifts(branchId?: string, page = 1) {
  const session = await requireAuth();
  await requirePermission('sales:read');

  const targetBranchId = branchId || session.branchId;
  if (targetBranchId !== 'all') {
    await requireBranchAccess(targetBranchId);
  } else {
    // Only global admins can query all branches
    if (session.role.name !== 'Super Admin') {
      throw new Error('Unauthorized to view all branches');
    }
  }

  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ShiftWhereInput = {
    status: ShiftStatus.CLOSED,
  };

  if (targetBranchId !== 'all') {
    where.branchId = targetBranchId;
  }

  const [total, shifts] = await Promise.all([
    prisma.shift.count({ where }),
    prisma.shift.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { closedAt: 'desc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  return {
    success: true,
    data: {
      shifts: shifts.map(toSafeShiftDTO),
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
    },
  };
}
