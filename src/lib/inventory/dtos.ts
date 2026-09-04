import { BranchStock, StockMovement, Product } from '@/generated/prisma/client';

export type BranchStockWithProduct = BranchStock & {
  product?: Product | null;
};

export type SafeBranchStockDTO = Omit<BranchStock, 'createdAt' | 'updatedAt'> & {
  productName?: string;
  sku?: string;
};

export function toSafeBranchStockDTO(stock: BranchStockWithProduct): SafeBranchStockDTO {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = stock;
  return {
    ...rest,
    productName: stock.product?.name,
    sku: stock.product?.sku,
  };
}

export type StockMovementWithProduct = StockMovement & {
  product?: Product | null;
};

export type SafeStockMovementDTO = Omit<StockMovement, 'userId'> & {
  productName?: string;
  sku?: string;
};

export function toSafeStockMovementDTO(movement: StockMovementWithProduct): SafeStockMovementDTO {
  const { userId: _userId, ...rest } = movement;
  return {
    ...rest,
    productName: movement.product?.name,
    sku: movement.product?.sku,
  };
}
