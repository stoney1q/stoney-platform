import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth/guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Building2, Activity } from 'lucide-react';
import { RevenueWidget } from '@/components/dashboard/revenue-widget';
import { RepairQueueWidget } from '@/components/dashboard/repair-queue-widget';
import { InventoryAlertsWidget } from '@/components/dashboard/inventory-alerts-widget';
import { QuotationMetricsWidget } from '@/components/dashboard/quotation-metrics-widget';

function WidgetSkeleton() {
  return (
    <Card className="col-span-1 animate-pulse border-dashed">
      <CardHeader className="pb-2">
        <div className="bg-muted h-4 w-1/3 rounded"></div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted mb-2 h-8 w-1/2 rounded"></div>
        <div className="bg-muted h-3 w-3/4 rounded"></div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="flex flex-1 flex-col gap-4 lg:gap-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      </div>

      {/* User Context */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Welcome Back</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.firstName} {user.lastName}
            </div>
            <p className="text-muted-foreground text-xs">{user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Branch</CardTitle>
            <Building2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.branch.name}</div>
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              {user.branch.code}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Role</CardTitle>
            <ShieldCheck className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.role.name}</div>
            <p className="text-muted-foreground text-xs">
              {user.permissions.length} permissions granted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Widgets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<WidgetSkeleton />}>
          <RevenueWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <RepairQueueWidget userId={user.id} />
        </Suspense>
      </div>

      <div className="mt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton />}>
          <InventoryAlertsWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton />}>
          <QuotationMetricsWidget />
        </Suspense>
      </div>
    </div>
  );
}
