import { Repair, RepairPart, RepairLog, Device, Customer } from '@/generated/prisma/client';

export type RepairWithRelations = Repair & {
  parts?: RepairPart[];
  logs?: RepairLog[];
  device?: Device | null;
  customer?: Customer | null;
};

export type SafeRepairDTO = Omit<Repair, 'version' | 'updatedAt'> & {
  parts?: Omit<RepairPart, 'repairId' | 'version'>[];
  logs?: Omit<RepairLog, 'repairId' | 'userId'>[];
  device?: Omit<Device, 'customerId'> | null;
  customer?: Omit<Customer, 'createdById' | 'sequence'> | null;
};

export function toSafeRepairDTO(repair: RepairWithRelations): SafeRepairDTO {
  const { version: _version, updatedAt: _updatedAt, parts, logs, device, customer, ...rest } = repair;

  return {
    ...rest,
    parts: parts?.map(({ repairId: _repairId, version: _partVersion, ...partRest }) => partRest),
    logs: logs?.map(({ repairId: _logRepairId, userId: _userId, ...logRest }) => logRest),
    device: device ? (() => {
      const { customerId: _customerId, ...deviceRest } = device;
      return deviceRest;
    })() : null,
    customer: customer ? (() => {
      const { createdById: _createdById, sequence: _sequence, ...customerRest } = customer;
      return customerRest;
    })() : null,
  };
}
