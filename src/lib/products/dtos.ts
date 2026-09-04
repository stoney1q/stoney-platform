import { Product, Category, Brand } from '@/generated/prisma/client';

export type ProductWithRelations = Product & {
  category?: Category | null;
  brand?: Brand | null;
};

export type SafeProductDTO = Omit<Product, 'createdAt' | 'updatedAt'> & {
  category?: string | null;
  brand?: string | null;
};

export function toSafeProductDTO(product: ProductWithRelations): SafeProductDTO {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = product;
  return {
    ...rest,
    category: product.category?.name || null,
    brand: product.brand?.name || null,
  };
}
