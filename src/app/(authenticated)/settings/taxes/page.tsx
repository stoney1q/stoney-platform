import { getTaxRates } from '@/lib/settings/actions';
import { requirePermission } from '@/lib/auth/guard';
import { TaxRateForm } from './tax-rate-form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function TaxesPage() {
  await requirePermission('admin:global');
  const rates = await getTaxRates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Tax Rates</h2>
          <p className="text-sm text-gray-500">
            Manage tax rates that can be applied to products and services.
          </p>
        </div>
        <TaxRateForm />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No tax rates found.
                </TableCell>
              </TableRow>
            ) : (
              rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">
                    {rate.name}
                    {rate.isDefault && (
                      <Badge variant="secondary" className="ml-2">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{(Number(rate.rate) * 100).toFixed(2)}%</TableCell>
                  <TableCell>
                    <Badge variant={rate.isActive ? 'default' : 'secondary'}>
                      {rate.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(rate.createdAt, 'MMM d, yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <TaxRateForm initialData={rate} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
