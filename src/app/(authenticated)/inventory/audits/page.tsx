import { requirePermission } from '@/lib/auth/guard';
import { getAudits } from '@/lib/inventory/audit-actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default async function AuditsPage() {
  await requirePermission('inventory:read');
  const audits = await getAudits();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Audits</h2>
          <p className="text-muted-foreground">
            Manage cycle counts and physical inventory reconciliations.
          </p>
        </div>
        <Link href="/inventory/audits/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Audit
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {audits.length === 0 ? (
          <div className="text-muted-foreground bg-muted/20 rounded-lg border py-12 text-center">
            No audits found. Create one to start a physical count.
          </div>
        ) : (
          audits.map((audit) => (
            <Card key={audit.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {audit.name || `Audit #${audit.sequence}`}
                  </h3>
                  <div className="text-muted-foreground flex space-x-4 text-sm">
                    <span>Branch: {audit.branch.name}</span>
                    <span>
                      Created:{' '}
                      {format(new Date(audit.createdAt), 'MMM d, yyyy')}
                    </span>
                    <span>Items: {audit._count.items}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge
                    variant={
                      audit.status === 'COMPLETED'
                        ? 'default'
                        : audit.status === 'CANCELLED'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {audit.status}
                  </Badge>
                  <Link
                    href={`/inventory/audits/${audit.id}${audit.status !== 'IN_PROGRESS' ? '/review' : ''}`}
                  >
                    <Button variant="outline">View</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
