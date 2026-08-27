import { requirePermission } from '@/lib/auth/guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ArrowRightLeft, Warehouse, Layers, Tags } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function InventoryPage() {
  await requirePermission('inventory:read');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
        <p className="text-muted-foreground">
          Manage products, stock levels, and inter-branch transfers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Catalog</div>
            <p className="text-muted-foreground mb-4 text-xs">
              Manage SKUs and supplier links
            </p>
            <Link href="/inventory/products">
              <Button variant="outline" className="w-full">
                View Products
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branch Stock</CardTitle>
            <Warehouse className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Levels</div>
            <p className="text-muted-foreground mb-4 text-xs">
              Current on-hand balances
            </p>
            <Link href="/inventory/stock">
              <Button variant="outline" className="w-full">
                View Stock
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movements</CardTitle>
            <Layers className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Ledger</div>
            <p className="text-muted-foreground mb-4 text-xs">
              Audit log of all changes
            </p>
            <Link href="/inventory/movements">
              <Button variant="outline" className="w-full">
                View Ledger
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transfers</CardTitle>
            <ArrowRightLeft className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">In-Transit</div>
            <p className="text-muted-foreground mb-4 text-xs">
              Inter-branch logistics
            </p>
            <Link href="/inventory/transfers">
              <Button variant="outline" className="w-full">
                View Transfers
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxonomy</CardTitle>
            <Tags className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Categories</div>
            <p className="text-muted-foreground mb-4 text-xs">
              Manage product classifications
            </p>
            <Link href="/inventory/taxonomy">
              <Button variant="outline" className="w-full">
                View Taxonomy
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
