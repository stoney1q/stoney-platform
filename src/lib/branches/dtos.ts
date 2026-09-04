import { Branch } from '@/generated/prisma/client';

export type SafeBranchDTO = Omit<Branch, 'createdAt' | 'updatedAt'>;

export function toSafeBranchDTO(branch: Branch): SafeBranchDTO {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = branch;
  return rest;
}
