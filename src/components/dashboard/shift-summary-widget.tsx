import { getShiftSummary, ShiftSummaryDTO } from '@/lib/dashboard/queries';
import { getPublicStoreSettings } from '@/lib/settings/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ExternalLink } from 'lucide-react';
import { AuthError } from '@/lib/auth/guard';
import Link from 'next/link';

function formatElapsedTime(openedAt: string): string {
  const diffMs = Date.now() - new Date(openedAt).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export async function ShiftSummaryWidget() {
  let summary: ShiftSummaryDTO | null = null;
  let authError = false;

  try {
    summary = await getShiftSummary();
  } catch (error) {
    if (error instanceof AuthError && error.code === 'FORBIDDEN') {
      authError = true;
    }
  }

  if (authError) {
    return null;
  }

  if (!summary) {
    return (
      <Card className="col-span-1 border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-600">
          Failed to load shift summary.
        </CardContent>
      </Card>
    );
  }

  const { currencySymbol } = await getPublicStoreSettings();

  if (!summary.hasOpenShift) {
    return (
      <Card className="col-span-1 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Shift Status</CardTitle>
          <Wallet className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              No Shift Open
            </span>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Open a shift before taking cash payments.
          </p>
          <Link
            href="/shifts"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            Go to Shifts <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Active Shift</CardTitle>
        <Wallet className="h-4 w-4 text-green-600" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
            ● Open
          </span>
          {summary.openedAt && (
            <span className="text-muted-foreground text-xs">
              {formatElapsedTime(summary.openedAt)}
            </span>
          )}
        </div>

        <div className="mt-2 text-2xl font-bold">
          {currencySymbol}
          {summary.expectedBalance}
        </div>
        <p className="text-muted-foreground text-xs">Expected cash in drawer</p>

        <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <span>Opening float</span>
          <span className="text-right">
            {currencySymbol}
            {summary.openingBalance}
          </span>
          <span>Cash sales</span>
          <span className="text-right text-green-700 dark:text-green-400">
            +{currencySymbol}
            {summary.cashSalesTotal}
          </span>
          {parseFloat(summary.cashInTotal) > 0 && (
            <>
              <span>Cash in</span>
              <span className="text-right text-green-700 dark:text-green-400">
                +{currencySymbol}
                {summary.cashInTotal}
              </span>
            </>
          )}
          {parseFloat(summary.cashOutTotal) > 0 && (
            <>
              <span>Cash out</span>
              <span className="text-right text-red-600 dark:text-red-400">
                -{currencySymbol}
                {summary.cashOutTotal}
              </span>
            </>
          )}
        </div>

        <Link
          href="/shifts"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
        >
          Manage Shift <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
