import { join } from 'path';

export type E2EState = {
  branchId: string;
  userId: string;
  userEmail: string;
  posProductId: string;
  posProductSku: string;
  posCustomerId: string;
  portalQuotationId: string;
  portalQuotationToken: string;
  portalCustomerId: string;
  portalCustomerEmail: string;
};

export const STATE_FILE = join(__dirname, '.e2e-state.json');
