export type Money = string;

export interface ReportDateRange {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface ReportParams {
  branchId?: string;
  dateRange?: ReportDateRange;
}

export interface SalesReportDTO {
  date: string; // YYYY-MM-DD
  revenue: Money;
  transactionCount: number;
}

export interface SalesStatusDTO {
  status: string;
  count: number;
  revenue: Money;
}

export interface RepairVolumeDTO {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface RepairStatusDTO {
  status: string;
  count: number;
}

export interface QuotationStatusDTO {
  status: string;
  count: number;
}

export interface InventoryMovementDTO {
  type: string;
  count: number;
  quantity: number;
}
