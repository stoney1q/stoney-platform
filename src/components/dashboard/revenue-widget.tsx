import { getRevenueMetrics, RevenueMetricsDTO } from '@/lib/dashboard/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock } from 'lucide-react';
import { AuthError } from '@/lib/auth/guard';

export async function RevenueWidget() {
  let metrics: RevenueMetricsDTO | null = null;
  let authError = false;

  try {
    metrics = await getRevenueMetrics();
  } catch (error) {
    if (error instanceof AuthError && error.code === 'FORBIDDEN') {
      authError = true;
    }
  }

  if (authError) {
    return null;
  }

  if (!metrics) {
    return (
      <Card className="col-span-full border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-600">
          Failed to load revenue metrics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="col-span-full grid gap-4 md:grid-cols-3 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue (Today)</CardTitle>
          <DollarSign className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.todayTotal}</div>
          <p className="text-muted-foreground text-xs">
            {metrics.completedSalesCount} completed sales
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Revenue (This Week)
          </CardTitle>
          <DollarSign className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.weekTotal}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Payments
          </CardTitle>
          <Clock className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.pendingTotal}</div>
          <p className="text-muted-foreground text-xs">Outstanding balances</p>
        </CardContent>
      </Card>
    </div>
  );
}
