// src/lib/ai/dtos.ts

export interface SafeInventoryDTO {
  id: string;
  name: string;
  sku: string;
  stockLevel: number;
  lowStockThreshold: number;
  category?: string;
  brand?: string;
}

export interface SafeRepairDTO {
  id: string;
  sequence: number;
  status: string;
  deviceModel: string;
  reportedIssue: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Strips all sensitive pricing, cost, and supplier data from an inventory record.
 */
export function toSafeInventoryDTO(
  product: { id: string; name?: string; sku?: string; category?: { name: string } | null; brand?: { name: string } | null },
  branchStock?: { onHand?: number; reorderLevel?: number } | null
): SafeInventoryDTO {
  return {
    id: product.id,
    name: product.name || 'Unknown Product',
    sku: product.sku || product.id, // Fallback if sku isn't directly on product
    stockLevel: branchStock?.onHand ?? 0,
    lowStockThreshold: branchStock?.reorderLevel ?? 0,
    category: product.category?.name ?? undefined,
    brand: product.brand?.name ?? undefined,
  };
}

/**
 * Strips all customer PII and internal technician IDs from a repair record.
 */
export function toSafeRepairDTO(
  repair: { id: string; sequence: number; status: string; device?: { model: string } | null; issue: string; notes?: string | null; createdAt?: Date; completedAt?: Date | null }
): SafeRepairDTO {
  return {
    id: repair.id,
    sequence: repair.sequence,
    status: repair.status,
    deviceModel: repair.device?.model || 'Unknown Device',
    reportedIssue: repair.issue,
    notes: repair.notes || undefined,
    createdAt: repair.createdAt?.toISOString() || new Date().toISOString(),
    completedAt: repair.completedAt?.toISOString() || undefined,
  };
}
