import {
  getPaymentBreakdown,
  PaymentBreakdownDTO,
} from '@/lib/dashboard/queries';
import { getPublicStoreSettings } from '@/lib/settings/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import { AuthError } from '@/lib/auth/guard';

interface BreakdownRowProps {
  label: string;
  amount: string;
  currencySymbol: string;
  colorClass?: string;
}

function BreakdownRow({
  label,
  amount,
  currencySymbol,
  colorClass = '',
}: BreakdownRowProps) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium tabular-nums ${colorClass}`}>
        {currencySymbol}
        {amount}
      </span>
    </>
  );
}

export async function PaymentBreakdownWidget() {
  let breakdown: PaymentBreakdownDTO | null = null;
  let authError = false;

  try {
    breakdown = await getPaymentBreakdown();
  } catch (error) {
    if (error instanceof AuthError && error.code === 'FORBIDDEN') {
      authError = true;
    }
  }

  if (authError) {
    return null;
  }

  if (!breakdown) {
    return (
      <Card className="col-span-1 border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-600">
          Failed to load payment breakdown.
        </CardContent>
      </Card>
    );
  }

  const { currencySymbol } = await getPublicStoreSettings();
  const hasAnyPayments = parseFloat(breakdown.total) > 0;

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Today&apos;s Payments
        </CardTitle>
        <CreditCard className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        {!hasAnyPayments ? (
          <>
            <div className="text-2xl font-bold">{currencySymbol}0.00</div>
            <p className="text-muted-foreground text-xs">
              No completed payments yet today
            </p>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {currencySymbol}
              {breakdown.total}
            </div>
            <p className="text-muted-foreground mb-3 text-xs">
              Total collected today
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <BreakdownRow
                label="Cash"
                amount={breakdown.cash}
                currencySymbol={currencySymbol}
                colorClass="text-green-700 dark:text-green-400"
              />
              <BreakdownRow
                label="Card"
                amount={breakdown.card}
                currencySymbol={currencySymbol}
                colorClass="text-blue-600 dark:text-blue-400"
              />
              <BreakdownRow
                label="Transfer"
                amount={breakdown.transfer}
                currencySymbol={currencySymbol}
                colorClass="text-purple-600 dark:text-purple-400"
              />
              {parseFloat(breakdown.other) > 0 && (
                <BreakdownRow
                  label="Other"
                  amount={breakdown.other}
                  currencySymbol={currencySymbol}
                />
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
