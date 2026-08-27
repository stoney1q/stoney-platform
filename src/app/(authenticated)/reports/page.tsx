import { requirePermission } from '@/lib/auth/guard';
import {
  getSalesRevenueReport,
  getSalesStatusReport,
  getRepairStatusReport,
  getQuotationStatusReport,
  getInventoryMovementReport,
} from '@/lib/reports/queries';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportTable } from '@/components/reports/ReportTable';
import {
  SalesRevenueChart,
  StatusDistributionChart,
  InventoryMovementChart,
} from '@/components/reports/ReportCharts';
import { ExportCSVButton } from '@/components/reports/ExportCSVButton';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission('reports:read');
  const showBranchSelector =
    user.role.name === 'Super Admin' ||
    user.permissions.includes('admin:global');

  // Await the Next.js searchParams in Next.js 15
  const params = await searchParams;

  const dateRange = {
    from: params.from as string | undefined,
    to: params.to as string | undefined,
  };
  const branchId = params.branchId as string | undefined;

  const queryParams = { dateRange, branchId };

  // Fetch all report data
  const [
    salesRevenue,
    salesStatus,
    repairStatus,
    quotationStatus,
    inventoryMovement,
  ] = await Promise.all([
    getSalesRevenueReport(queryParams),
    getSalesStatusReport(queryParams),
    getRepairStatusReport(queryParams),
    getQuotationStatusReport(queryParams),
    getInventoryMovementReport(queryParams),
  ]);

  return (
    <div className="space-y-6">
      <ReportFilters showBranchSelector={showBranchSelector} />

      <div className="space-y-12">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Sales</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative rounded-md border p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-lg font-semibold">Revenue Trend</h3>
                <ExportCSVButton
                  reportType="salesRevenue"
                  filename="sales_revenue.csv"
                />
              </div>
              <SalesRevenueChart data={salesRevenue} />
              <div className="mt-4">
                <ReportTable
                  data={salesRevenue}
                  columns={[
                    { header: 'Date', accessor: 'date' },
                    { header: 'Revenue', accessor: 'revenue' },
                    { header: 'Tx Count', accessor: 'transactionCount' },
                  ]}
                />
              </div>
            </div>

            <div className="relative rounded-md border p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-lg font-semibold">Status Distribution</h3>
                <ExportCSVButton
                  reportType="salesStatus"
                  filename="sales_status.csv"
                />
              </div>
              <StatusDistributionChart data={salesStatus} />
              <div className="mt-4">
                <ReportTable
                  data={salesStatus}
                  columns={[
                    { header: 'Status', accessor: 'status' },
                    { header: 'Revenue', accessor: 'revenue' },
                    { header: 'Count', accessor: 'count' },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Repairs</h2>
          <div className="relative rounded-md border p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-lg font-semibold">
                Repair Status Distribution
              </h3>
              <ExportCSVButton
                reportType="repairStatus"
                filename="repair_status.csv"
              />
            </div>
            <StatusDistributionChart data={repairStatus} />
            <div className="mt-4">
              <ReportTable
                data={repairStatus}
                columns={[
                  { header: 'Status', accessor: 'status' },
                  { header: 'Count', accessor: 'count' },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Quotations</h2>
          <div className="relative rounded-md border p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-lg font-semibold">
                Quotation Status Distribution
              </h3>
              <ExportCSVButton
                reportType="quotationStatus"
                filename="quotation_status.csv"
              />
            </div>
            <StatusDistributionChart data={quotationStatus} />
            <div className="mt-4">
              <ReportTable
                data={quotationStatus}
                columns={[
                  { header: 'Status', accessor: 'status' },
                  { header: 'Count', accessor: 'count' },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Inventory</h2>
          <div className="relative rounded-md border p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-lg font-semibold">Stock Movements</h3>
              <ExportCSVButton
                reportType="inventoryMovement"
                filename="inventory_movement.csv"
              />
            </div>
            <InventoryMovementChart data={inventoryMovement} />
            <div className="mt-4">
              <ReportTable
                data={inventoryMovement}
                columns={[
                  { header: 'Movement Type', accessor: 'type' },
                  { header: 'Event Count', accessor: 'count' },
                  { header: 'Net Quantity', accessor: 'quantity' },
                ]}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
