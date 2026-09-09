import { requirePermission } from '@/lib/auth/guard';
import {
  getSalesRevenueReport,
  getSalesStatusReport,
  getRepairStatusReport,
  getQuotationStatusReport,
  getInventoryMovementReport,
  getProductPerformanceReport,
  getProfitabilityReport,
  getShiftReconciliationReport,
} from '@/lib/reports/queries';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportTable } from '@/components/reports/ReportTable';
import {
  SalesRevenueChart,
  StatusDistributionChart,
  InventoryMovementChart,
  ProfitMarginChart,
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
    productPerformance,
    profitability,
    shiftReconciliation,
  ] = await Promise.all([
    getSalesRevenueReport(queryParams),
    getSalesStatusReport(queryParams),
    getRepairStatusReport(queryParams),
    getQuotationStatusReport(queryParams),
    getInventoryMovementReport(queryParams),
    getProductPerformanceReport(queryParams),
    getProfitabilityReport(queryParams),
    getShiftReconciliationReport(queryParams),
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
            <div className="relative rounded-md border p-4 shadow-sm md:col-span-2">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-lg font-semibold">
                  Profitability & Margin
                </h3>
                <ExportCSVButton
                  reportType="profitability"
                  filename="profitability.csv"
                />
              </div>
              <ProfitMarginChart data={profitability} />
              <div className="mt-4">
                <ReportTable
                  data={profitability}
                  columns={[
                    { header: 'Date', accessor: 'date' },
                    { header: 'Revenue', accessor: 'revenue' },
                    { header: 'COGS', accessor: 'cogs' },
                    { header: 'Gross Profit', accessor: 'grossProfit' },
                    { header: 'Margin %', accessor: 'marginPercentage' },
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
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Products</h2>
          <div className="relative rounded-md border p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-lg font-semibold">Top Performing Products</h3>
              <ExportCSVButton
                reportType="productPerformance"
                filename="product_performance.csv"
              />
            </div>
            <div className="mt-4">
              <ReportTable
                data={productPerformance}
                columns={[
                  { header: 'SKU', accessor: 'sku' },
                  { header: 'Product Name', accessor: 'productName' },
                  { header: 'Quantity Sold', accessor: 'quantitySold' },
                  { header: 'Revenue', accessor: 'revenue' },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Shifts & Cash Reconciliation</h2>
          <div className="relative rounded-md border p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-lg font-semibold">
                End of Day Discrepancies
              </h3>
              <ExportCSVButton
                reportType="shiftReconciliation"
                filename="shift_reconciliation.csv"
              />
            </div>
            <div className="mt-4">
              <ReportTable
                data={shiftReconciliation}
                columns={[
                  { header: 'Date', accessor: 'date' },
                  { header: 'Branch', accessor: 'branchName' },
                  { header: 'Expected Balance', accessor: 'expectedBalance' },
                  { header: 'Actual Balance', accessor: 'actualBalance' },
                  { header: 'Discrepancy', accessor: 'discrepancy' },
                ]}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
