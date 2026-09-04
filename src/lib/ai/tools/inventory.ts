// src/lib/ai/tools/inventory.ts

import { tool } from 'ai';
import { z } from 'zod';
import { toSafeInventoryDTO } from '../dtos';
import { getLowStockItems } from '@/lib/inventory/actions';

export function getInventoryTools(branchId: string) {
  return {
    getLowStockInventory: tool({
      description: 'Fetch inventory items that are running low on stock or out of stock for the current branch.',
      inputSchema: z.object({
        limit: z.number().min(1).max(50).default(10).describe('The maximum number of low stock items to return.'),
      }),
      execute: async (args) => {
        const { limit } = args;
        const lowStockItems = await getLowStockItems(branchId, limit);
        return lowStockItems.map((item) => toSafeInventoryDTO(item.product, item));
      },
    }),
  };
}
