import {
  getQuotationMetrics,
  QuotationMetricsDTO,
} from '@/lib/dashboard/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { AuthError } from '@/lib/auth/guard';

export async function QuotationMetricsWidget() {
  let metrics: QuotationMetricsDTO | null = null;
  let authError = false;

  try {
    metrics = await getQuotationMetrics();
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
      <Card className="col-span-1 border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-600">
          Failed to load quotation metrics.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Active Quotations</CardTitle>
        <FileText className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metrics.sent}</div>
        <p className="text-muted-foreground text-xs">
          {metrics.draft} Drafts / {metrics.accepted} Accepted
        </p>
      </CardContent>
    </Card>
  );
}
