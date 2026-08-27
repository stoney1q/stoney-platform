'use client';

import { Button } from '@/components/ui/button';
import { exportReportCSV } from '@/lib/reports/actions';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface ExportCSVButtonProps {
  reportType:
    | 'salesRevenue'
    | 'salesStatus'
    | 'repairStatus'
    | 'quotationStatus'
    | 'inventoryMovement';
  filename: string;
}

export function ExportCSVButton({
  reportType,
  filename,
}: ExportCSVButtonProps) {
  const searchParams = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const from = searchParams.get('from') || undefined;
      const to = searchParams.get('to') || undefined;
      const branchId = searchParams.get('branchId') || undefined;

      const dateRange = from && to ? { from, to } : undefined;

      const csvString = await exportReportCSV(reportType, {
        branchId,
        dateRange,
      });

      if (!csvString) {
        setError('No data available to export');
        return;
      }

      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export CSV'}
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
