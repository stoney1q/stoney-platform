import React from 'react';
import { ThermalPrintWrapper } from './ThermalPrintWrapper';
import { Prisma } from '@/generated/prisma/client';

export type DocumentSnapshotData = {
  branch: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    code: string;
  };
  settings: {
    currencySymbol: string;
    currencyCode: string;
    receiptFooter?: string | null;
    taxRegistration?: string | null;
  };
  generatedAt: string;
};

type ReceiptTemplateProps = {
  documentNumber: string | null;
  type: 'SALE' | 'REPAIR' | 'QUOTATION';
  snapshotData: DocumentSnapshotData | any;
  customer?: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    total: Prisma.Decimal;
  }>;
  totals: {
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
  };
  payments?: Array<{
    method: string;
    amount: Prisma.Decimal;
    createdAt: Date;
  }>;
  date: Date;
  preview?: boolean;
};

export function ReceiptTemplate({
  documentNumber,
  type,
  snapshotData,
  customer,
  items,
  totals,
  payments = [],
  date,
  preview = false,
}: ReceiptTemplateProps) {
  const data = snapshotData as DocumentSnapshotData;
  if (!data?.branch || !data?.settings) {
    return <div>Missing snapshot data for document</div>;
  }

  const { branch, settings } = data;
  const curr = settings.currencySymbol || '$';

  return (
    <ThermalPrintWrapper preview={preview}>
      <div className="mb-4 text-center">
        <h1 className="text-lg font-bold uppercase">{branch.name}</h1>
        {branch.address && (
          <p className="whitespace-pre-line">{branch.address}</p>
        )}
        {branch.phone && <p>Tel: {branch.phone}</p>}
        {settings.taxRegistration && <p>Tax ID: {settings.taxRegistration}</p>}
      </div>

      <div className="mb-2 border-b border-dashed border-gray-400 pb-2">
        <p className="mb-1 text-center font-bold tracking-widest uppercase">
          {type}
        </p>
        <div className="flex justify-between">
          <span>{date.toLocaleDateString()}</span>
          <span>{date.toLocaleTimeString()}</span>
        </div>
        <p>Doc #: {documentNumber || 'PENDING'}</p>
        {customer && (
          <p className="mt-1">
            Customer: {customer.firstName} {customer.lastName}
          </p>
        )}
      </div>

      <div className="mb-2 border-b border-dashed border-gray-400 pb-2">
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="w-full font-normal">Item</th>
              <th className="px-2 text-right font-normal">Qty</th>
              <th className="text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="align-top">
                <td className="pr-1 break-words">{item.productName}</td>
                <td className="px-2 text-right">{item.quantity}</td>
                <td className="text-right whitespace-nowrap">
                  {curr}
                  {item.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-2 space-y-1 border-b border-dashed border-gray-400 pb-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>
            {curr}
            {totals.subtotal.toFixed(2)}
          </span>
        </div>
        {totals.discount.greaterThan(0) && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>
              -{curr}
              {totals.discount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax</span>
          <span>
            {curr}
            {totals.taxAmount.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>
            {curr}
            {totals.total.toFixed(2)}
          </span>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="mb-2 border-b border-dashed border-gray-400 pb-2">
          <p className="mb-1 font-bold">Payments</p>
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.method}</span>
              <span>
                {curr}
                {p.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-center">
        {settings.receiptFooter ? (
          <p className="text-xs whitespace-pre-line">
            {settings.receiptFooter}
          </p>
        ) : (
          <p>Thank you for your business!</p>
        )}
      </div>

      {/* Trigger print button (hidden when actually printing) */}
      <div className="no-print mt-6 text-center">
        <button
          onClick={() => window.print()}
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Print Receipt
        </button>
      </div>
    </ThermalPrintWrapper>
  );
}
