'use server';

import { requirePermission } from '@/lib/auth/guard';
import {
  getSalesRevenueReport,
  getSalesStatusReport,
  getRepairStatusReport,
  getQuotationStatusReport,
  getInventoryMovementReport,
} from './queries';
import { ReportParams } from './types';

export async function exportReportCSV(
  reportType:
    | 'salesRevenue'
    | 'salesStatus'
    | 'repairStatus'
    | 'quotationStatus'
    | 'inventoryMovement',
  params?: ReportParams
): Promise<string> {
  await requirePermission('reports:export');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] = [];
  switch (reportType) {
    case 'salesRevenue':
      data = await getSalesRevenueReport(params);
      break;
    case 'salesStatus':
      data = await getSalesStatusReport(params);
      break;
    case 'repairStatus':
      data = await getRepairStatusReport(params);
      break;
    case 'quotationStatus':
      data = await getQuotationStatusReport(params);
      break;
    case 'inventoryMovement':
      data = await getInventoryMovementReport(params);
      break;
    default:
      throw new Error('Invalid report type');
  }

  if (!data || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        if (typeof value === 'string') {
          // Prevent formula injection
          let safeValue = value;
          if (/^[=+\-@]/.test(safeValue)) {
            safeValue = ' ' + safeValue;
          }
          // Escape quotes by doubling them and wrap in quotes
          safeValue = safeValue.replace(/"/g, '""');
          return `"${safeValue}"`;
        }
        return value;
      })
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
