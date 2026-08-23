import { getLowStockAlerts, LowStockAlertDTO } from '@/lib/dashboard/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { AuthError } from '@/lib/auth/guard';

export async function InventoryAlertsWidget() {
  let alerts: LowStockAlertDTO | null = null;
  let authError = false;

  try {
    alerts = await getLowStockAlerts();
  } catch (error) {
    if (error instanceof AuthError && error.code === 'FORBIDDEN') {
      authError = true;
    }
  }

  if (authError) {
    return null;
  }

  if (!alerts) {
    return (
      <Card className="col-span-1 border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-600">
          Failed to load inventory alerts.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Inventory Alerts</CardTitle>
        <AlertTriangle className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{alerts.count}</div>
        <p className="text-muted-foreground text-xs">
          Low or out-of-stock items
        </p>
      </CardContent>
    </Card>
  );
}
