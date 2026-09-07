'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  upsertAuditItem,
  updateAuditStatus,
} from '@/lib/inventory/audit-actions';
import { Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ActiveAuditInterface({
  audit,
  catalog,
}: {
  audit: any;
  catalog: any[];
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Quick client side search
  const filteredCatalog = catalog
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 10);

  const handleAddCount = async (productId: string, quantity: number) => {
    if (quantity <= 0) return;
    setLoading(true);
    try {
      await upsertAuditItem(audit.id, productId, quantity, 'increment');
      setSearchTerm('');
      router.refresh();
    } catch (e) {
      alert('Failed to update count');
    }
    setLoading(false);
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      await updateAuditStatus(audit.id, 'REVIEW');
      router.push(`/inventory/audits/${audit.id}/review`);
    } catch (e) {
      alert('Failed to finish counting');
      setFinishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                placeholder="Scan or search SKU / Product Name..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              disabled={finishing}
              onClick={handleFinish}
              variant="default"
            >
              Finish Counting
            </Button>
          </div>

          {searchTerm && (
            <div className="divide-y rounded-md border">
              {filteredCatalog.map((product) => (
                <div
                  key={product.id}
                  className="hover:bg-muted/50 flex items-center justify-between p-3"
                >
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-muted-foreground text-sm">
                      {product.sku}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddCount(product.id, 1)}
                      disabled={loading}
                    >
                      +1
                    </Button>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(
                          e.target as HTMLFormElement
                        );
                        const qty = parseInt(formData.get('qty') as string, 10);
                        if (!isNaN(qty)) handleAddCount(product.id, qty);
                      }}
                      className="flex space-x-2"
                    >
                      <Input
                        name="qty"
                        type="number"
                        min="1"
                        className="h-9 w-20"
                        placeholder="Qty"
                      />
                      <Button size="sm" type="submit" disabled={loading}>
                        Add
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="text-muted-foreground p-3 text-center">
                  No products found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-lg font-semibold">
            Counted Items ({audit.items.length})
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Counted Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.product.sku}
                    </TableCell>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell className="text-right text-lg font-bold">
                      {item.countedQuantity}
                    </TableCell>
                  </TableRow>
                ))}
                {audit.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-muted-foreground py-8 text-center"
                    >
                      No items counted yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
