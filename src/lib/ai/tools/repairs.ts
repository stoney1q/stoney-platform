// src/lib/ai/tools/repairs.ts

import { tool } from 'ai';
import { z } from 'zod';
import { toSafeRepairDTO } from '../dtos';
import { getActiveRepairDiagnostics } from '@/lib/repairs/actions';

export function getRepairTools(branchId: string) {
  return {
    getRepairDiagnostics: tool({
      description: 'Search for active repair tickets by device model to understand common issues or check status for the current branch.',
      inputSchema: z.object({
        deviceModel: z.string().max(100).describe('The make or model of the device to search for.'),
      }),
      execute: async (args) => {
        const { deviceModel } = args;
        const repairs = await getActiveRepairDiagnostics(branchId, deviceModel, 10);
        return repairs.map(toSafeRepairDTO);
      },
    }),
  };
}
