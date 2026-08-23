'use server';

import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  requirePermission,
  requireBranchAccess,
} from '@/lib/auth/guard';
import {
  createRepairSchema,
  updateRepairStatusSchema,
  assignTechnicianSchema,
  planRepairPartSchema,
  consumeRepairPartSchema,
  returnRepairPartSchema,
  cancelRepairSchema,
  createDeviceSchema,
  updateDeviceSchema,
} from './validation';
import { RepairStatus, MovementType } from '@/generated/prisma/client';

export async function createRepair(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('repairs:create');

  const rawData = {
    customerId: formData.get('customerId') as string,
    deviceId: formData.get('deviceId') as string,
    issue: formData.get('issue') as string,
    notes: (formData.get('notes') as string) || undefined,
  };

  const data = createRepairSchema.parse(rawData);

  // Validate the device belongs to the customer
  const device = await prisma.device.findUnique({
    where: { id: data.deviceId },
  });
  if (!device || device.customerId !== data.customerId) {
    throw new Error('Device does not belong to the selected customer');
  }

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.create({
      data: {
        branchId: session.branchId,
        customerId: data.customerId,
        deviceId: data.deviceId,
        issue: data.issue,
        notes: data.notes,
        status: RepairStatus.RECEIVED,
      },
    });

    await tx.repairLog.create({
      data: {
        repairId: repair.id,
        userId: session.id,
        newState: RepairStatus.RECEIVED,
        notes: 'Repair ticket created',
      },
    });

    return repair;
  });
}

export async function updateRepairStatus(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('repairs:update');

  const rawData = {
    repairId: formData.get('repairId') as string,
    status: formData.get('status') as RepairStatus,
    notes: (formData.get('notes') as string) || undefined,
    version: Number(formData.get('version')),
  };

  const data = updateRepairStatusSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUniqueOrThrow({
      where: { id: data.repairId },
    });

    await requireBranchAccess(repair.branchId);

    if (
      repair.status === RepairStatus.COMPLETED ||
      repair.status === RepairStatus.DELIVERED ||
      repair.status === RepairStatus.CANCELLED
    ) {
      throw new Error('Cannot update status of a finalized repair');
    }

    const updatedRepair = await tx.repair.update({
      where: { id: repair.id, version: data.version },
      data: {
        status: data.status,
        version: { increment: 1 },
        completedAt:
          data.status === RepairStatus.COMPLETED ? new Date() : undefined,
      },
    });

    await tx.repairLog.create({
      data: {
        repairId: repair.id,
        userId: session.id,
        previousState: repair.status,
        newState: data.status,
        notes: data.notes || `Status updated to ${data.status}`,
      },
    });

    return updatedRepair;
  });
}

export async function assignTechnician(formData: FormData) {
  await requireAuth();
  await requirePermission('repairs:assign');

  const rawData = {
    repairId: formData.get('repairId') as string,
    technicianId: (formData.get('technicianId') as string) || null,
    version: Number(formData.get('version')),
  };

  const data = assignTechnicianSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUniqueOrThrow({
      where: { id: data.repairId },
    });

    await requireBranchAccess(repair.branchId);

    return tx.repair.update({
      where: { id: repair.id, version: data.version },
      data: {
        technicianId: data.technicianId,
        version: { increment: 1 },
      },
    });
  });
}

export async function planRepairPart(formData: FormData) {
  await requireAuth();
  await requirePermission('repairs:update');

  const rawData = {
    repairId: formData.get('repairId') as string,
    productId: formData.get('productId') as string,
    plannedQuantity: Number(formData.get('plannedQuantity')),
    version: Number(formData.get('version')),
  };

  const data = planRepairPartSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUniqueOrThrow({
      where: { id: data.repairId },
    });

    await requireBranchAccess(repair.branchId);

    if (
      repair.status === RepairStatus.COMPLETED ||
      repair.status === RepairStatus.DELIVERED ||
      repair.status === RepairStatus.CANCELLED
    ) {
      throw new Error('Cannot plan parts for a finalized repair');
    }

    // Atomic check on repair version
    await tx.repair.update({
      where: { id: repair.id, version: data.version },
      data: { version: { increment: 1 } },
    });

    const existingPart = await tx.repairPart.findUnique({
      where: {
        repairId_productId: { repairId: repair.id, productId: data.productId },
      },
    });

    if (existingPart) {
      return tx.repairPart.update({
        where: { id: existingPart.id },
        data: {
          plannedQuantity: data.plannedQuantity,
          version: { increment: 1 },
        },
      });
    } else {
      return tx.repairPart.create({
        data: {
          repairId: repair.id,
          productId: data.productId,
          plannedQuantity: data.plannedQuantity,
        },
      });
    }
  });
}

export async function consumeRepairPart(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('repairs:update');
  await requirePermission('inventory:write');

  const rawData = {
    repairId: formData.get('repairId') as string,
    productId: formData.get('productId') as string,
    quantity: Number(formData.get('quantity')),
    version: Number(formData.get('version')),
  };

  const data = consumeRepairPartSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUniqueOrThrow({
      where: { id: data.repairId },
    });

    await requireBranchAccess(repair.branchId);

    if (
      repair.status === RepairStatus.COMPLETED ||
      repair.status === RepairStatus.DELIVERED ||
      repair.status === RepairStatus.CANCELLED
    ) {
      throw new Error('Cannot consume parts for a finalized repair');
    }

    // Atomically increment repair version to ensure no concurrent modification
    await tx.repair.update({
      where: { id: repair.id, version: data.version },
      data: { version: { increment: 1 } },
    });

    const existingPart = await tx.repairPart.findUnique({
      where: {
        repairId_productId: { repairId: repair.id, productId: data.productId },
      },
    });

    // 1. Raw SQL conditional inventory update
    const result = await tx.$executeRaw`
      UPDATE "BranchStock"
      SET "onHand" = "onHand" - ${data.quantity},
          "updatedAt" = NOW()
      WHERE "branchId" = ${repair.branchId}
        AND "productId" = ${data.productId}
        AND ("onHand" - "reserved") >= ${data.quantity}
    `;

    if (result === 0) {
      throw new Error('Insufficient stock to consume');
    }

    // 2. Create REPAIR_CONSUMPTION StockMovement
    await tx.stockMovement.create({
      data: {
        branchId: repair.branchId,
        productId: data.productId,
        quantity: -data.quantity,
        type: MovementType.REPAIR_CONSUMPTION,
        referenceId: repair.id,
        reason: 'Consumed for repair',
        userId: session.id,
      },
    });

    // 3. Update RepairPart
    if (existingPart) {
      return tx.repairPart.update({
        where: { id: existingPart.id },
        data: {
          consumedQuantity: { increment: data.quantity },
          version: { increment: 1 },
        },
      });
    } else {
      return tx.repairPart.create({
        data: {
          repairId: repair.id,
          productId: data.productId,
          consumedQuantity: data.quantity,
        },
      });
    }
  });
}

export async function returnRepairPart(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('repairs:update');
  await requirePermission('inventory:write');

  const rawData = {
    repairId: formData.get('repairId') as string,
    productId: formData.get('productId') as string,
    quantity: Number(formData.get('quantity')),
    version: Number(formData.get('version')),
  };

  const data = returnRepairPartSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUniqueOrThrow({
      where: { id: data.repairId },
    });

    await requireBranchAccess(repair.branchId);

    if (
      repair.status === RepairStatus.COMPLETED ||
      repair.status === RepairStatus.DELIVERED ||
      repair.status === RepairStatus.CANCELLED
    ) {
      throw new Error('Cannot return parts for a finalized repair');
    }

    const existingPart = await tx.repairPart.findUnique({
      where: {
        repairId_productId: { repairId: repair.id, productId: data.productId },
      },
    });

    if (!existingPart) {
      throw new Error('No such part exists on this repair');
    }

    const netConsumed =
      existingPart.consumedQuantity - existingPart.returnedQuantity;
    if (data.quantity > netConsumed) {
      throw new Error('Cannot return more parts than were consumed');
    }

    // Atomically increment repair version
    await tx.repair.update({
      where: { id: repair.id, version: data.version },
      data: { version: { increment: 1 } },
    });

    // 1. Raw SQL inventory increment
    await tx.$executeRaw`
      UPDATE "BranchStock"
      SET "onHand" = "onHand" + ${data.quantity},
          "updatedAt" = NOW()
      WHERE "branchId" = ${repair.branchId}
        AND "productId" = ${data.productId}
    `;

    // 2. Create RETURN StockMovement
    await tx.stockMovement.create({
      data: {
        branchId: repair.branchId,
        productId: data.productId,
        quantity: data.quantity,
        type: MovementType.RETURN,
        referenceId: repair.id,
        reason: 'Returned from repair',
        userId: session.id,
      },
    });

    // 3. Update RepairPart
    return tx.repairPart.update({
      where: { id: existingPart.id },
      data: {
        returnedQuantity: { increment: data.quantity },
        version: { increment: 1 },
      },
    });
  });
}

export async function cancelRepair(formData: FormData) {
  const session = await requireAuth();
  await requirePermission('repairs:delete');

  const rawData = {
    repairId: formData.get('repairId') as string,
    version: Number(formData.get('version')),
  };

  const data = cancelRepairSchema.parse(rawData);

  return prisma.$transaction(async (tx) => {
    const repair = await tx.repair.findUniqueOrThrow({
      where: { id: data.repairId },
      include: { parts: true },
    });

    await requireBranchAccess(repair.branchId);

    if (
      repair.status === RepairStatus.COMPLETED ||
      repair.status === RepairStatus.DELIVERED ||
      repair.status === RepairStatus.CANCELLED
    ) {
      throw new Error('Cannot cancel a finalized repair');
    }

    const hasNetConsumed = repair.parts.some(
      (p) => p.consumedQuantity - p.returnedQuantity > 0
    );

    if (hasNetConsumed) {
      throw new Error('Cannot cancel repair with unreturned consumed parts');
    }

    const updatedRepair = await tx.repair.update({
      where: { id: repair.id, version: data.version },
      data: {
        status: RepairStatus.CANCELLED,
        version: { increment: 1 },
      },
    });

    await tx.repairLog.create({
      data: {
        repairId: repair.id,
        userId: session.id,
        previousState: repair.status,
        newState: RepairStatus.CANCELLED,
        notes: 'Repair cancelled',
      },
    });

    return updatedRepair;
  });
}

export async function searchRepairs(params: {
  query?: string;
  page?: number;
  status?: RepairStatus;
}) {
  const session = await requireAuth();
  await requirePermission('repairs:read');

  const page = params.page || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    branchId: session.branchId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.query
      ? {
          OR: [
            { id: { contains: params.query, mode: 'insensitive' as const } },
            {
              customer: {
                firstName: {
                  contains: params.query,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              customer: {
                lastName: {
                  contains: params.query,
                  mode: 'insensitive' as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const [total, repairs] = await Promise.all([
    prisma.repair.count({ where }),
    prisma.repair.findMany({
      where,
      include: {
        customer: true,
        device: true,
        technician: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    success: true,
    data: {
      repairs,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    },
  };
}

export async function getRepairById(id: string) {
  const session = await requireAuth();
  await requirePermission('repairs:read');

  const repair = await prisma.repair.findUnique({
    where: { id },
    include: {
      customer: true,
      device: true,
      technician: true,
      branch: true,
      parts: {
        include: {
          product: true,
        },
      },
      logs: {
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!repair || repair.branchId !== session.branchId) {
    return null;
  }

  return repair;
}

export async function getCustomerDevices(customerId: string) {
  await requireAuth();
  await requirePermission('repairs:read'); // or whatever read permission is appropriate

  const devices = await prisma.device.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });

  return devices;
}

export async function createDevice(formData: FormData) {
  await requireAuth();
  await requirePermission('repairs:create');

  const rawData = {
    customerId: formData.get('customerId') as string,
    make: formData.get('make') as string,
    model: formData.get('model') as string,
    serialNumber: (formData.get('serialNumber') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  };

  const data = createDeviceSchema.parse(rawData);

  // Check if customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // If serial number is provided, check for uniqueness for this customer
  if (data.serialNumber) {
    const existing = await prisma.device.findUnique({
      where: {
        customerId_serialNumber: {
          customerId: data.customerId,
          serialNumber: data.serialNumber,
        },
      },
    });
    if (existing) {
      throw new Error(
        'A device with this serial number already exists for this customer'
      );
    }
  }

  return prisma.device.create({
    data: {
      customerId: data.customerId,
      make: data.make,
      model: data.model,
      serialNumber: data.serialNumber,
      notes: data.notes,
    },
  });
}

export async function updateDevice(formData: FormData) {
  await requireAuth();
  await requirePermission('repairs:update');

  const rawData = {
    deviceId: formData.get('deviceId') as string,
    make: formData.get('make') as string,
    model: formData.get('model') as string,
    serialNumber: (formData.get('serialNumber') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  };

  const data = updateDeviceSchema.parse(rawData);

  const device = await prisma.device.findUniqueOrThrow({
    where: { id: data.deviceId },
  });

  if (data.serialNumber && data.serialNumber !== device.serialNumber) {
    const existing = await prisma.device.findUnique({
      where: {
        customerId_serialNumber: {
          customerId: device.customerId,
          serialNumber: data.serialNumber,
        },
      },
    });
    if (existing) {
      throw new Error(
        'A device with this serial number already exists for this customer'
      );
    }
  }

  return prisma.device.update({
    where: { id: device.id },
    data: {
      make: data.make,
      model: data.model,
      serialNumber: data.serialNumber,
      notes: data.notes,
    },
  });
}

export async function deleteDevice(deviceId: string) {
  await requireAuth();
  await requirePermission('repairs:delete');

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: {
      _count: {
        select: { repairs: true },
      },
    },
  });

  if (!device) return;

  if (device._count.repairs > 0) {
    throw new Error('Cannot delete a device that has associated repairs');
  }

  return prisma.device.delete({
    where: { id: device.id },
  });
}
