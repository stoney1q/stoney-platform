import { getPortalDocument } from '@/lib/portal/actions';
import { verifyPortalCookie } from '@/lib/portal/auth';
import { VerificationForm } from '@/components/portal/verification-form';
import { QuotationActions } from '@/components/portal/quotation-actions';
import { QuotationStatus, RepairStatus } from '@/generated/prisma/client';

export default async function PortalPage({
  params,
}: {
  params: { portalToken: string };
}) {
  const { portalToken } = params;

  // 1. Check if authenticated
  const payload = await verifyPortalCookie();

  if (!payload || payload.portalToken !== portalToken) {
    return <VerificationForm portalToken={portalToken} />;
  }

  // 2. Fetch document
  try {
    const data = await getPortalDocument(portalToken);

    if (data.type === 'QUOTATION') {
      const doc = data.document as any;
      return (
        <div className="rounded-lg bg-white p-6 shadow sm:p-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Quotation #{doc.documentNumber || doc.id.substring(0, 8)}
              </h2>
              <p className="mt-1 text-gray-500">
                Status:{' '}
                <span className="font-medium text-gray-900">{doc.status}</span>
              </p>
            </div>
            <div className="text-right text-gray-500">
              <p>{doc.branch.name}</p>
              <p>{doc.branch.phone}</p>
              <p>{doc.branch.email}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Items</h3>
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Item
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {doc.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                        {item.product.name}
                      </td>
                      <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-gray-500">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-gray-900">
                        ${Number(item.total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-8 flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>${Number(doc.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Discount</span>
                <span>-${Number(doc.discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span>
                <span>${Number(doc.taxAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3 text-lg font-medium text-gray-900">
                <span>Total</span>
                <span>${Number(doc.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {(doc.status === QuotationStatus.DRAFT ||
            doc.status === QuotationStatus.SENT) && (
            <QuotationActions portalToken={portalToken} version={doc.version} />
          )}

          {doc.status === QuotationStatus.ACCEPTED && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="rounded-md bg-green-50 p-4 text-green-800">
                This quotation has been approved. The store will process it
                shortly.
              </div>
            </div>
          )}

          {doc.status === QuotationStatus.REJECTED && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="rounded-md bg-gray-100 p-4 text-gray-800">
                This quotation was declined.
              </div>
            </div>
          )}
        </div>
      );
    } else if (data.type === 'REPAIR') {
      const doc = data.document as any;
      return (
        <div className="rounded-lg bg-white p-6 shadow sm:p-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Repair #{doc.documentNumber || doc.id.substring(0, 8)}
              </h2>
              <p className="mt-1 text-gray-500">
                Status:{' '}
                <span className="font-medium text-gray-900">{doc.status}</span>
              </p>
            </div>
            <div className="text-right text-gray-500">
              <p>{doc.branch.name}</p>
              <p>{doc.branch.phone}</p>
              <p>{doc.branch.email}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              Device Info
            </h3>
            <div className="rounded-md bg-gray-50 p-4">
              <p>
                <strong>Device:</strong> {doc.device.make} {doc.device.model}
              </p>
              <p className="mt-2">
                <strong>Issue:</strong> {doc.issue}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-medium text-gray-900">Timeline</h3>
            <div className="flow-root">
              <ul role="list" className="-mb-8">
                {doc.logs.map((log: any, logIdx: number) => (
                  <li key={log.id}>
                    <div className="relative pb-8">
                      {logIdx !== doc.logs.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                            <div className="h-2 w-2 rounded-full bg-gray-500" />
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-gray-500">
                              Status changed to{' '}
                              <span className="font-medium text-gray-900">
                                {log.newState}
                              </span>
                            </p>
                            {log.notes && (
                              <p className="mt-1 text-sm text-gray-600">
                                {log.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    } else if (data.type === 'SALE') {
      const doc = data.document as any;
      const totalPaid = doc.payments.reduce(
        (acc: number, p: any) => acc + Number(p.amount),
        0
      );
      const remainingBalance = Number(doc.total) - totalPaid;

      return (
        <div className="rounded-lg bg-white p-6 shadow sm:p-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Invoice #{doc.documentNumber || doc.id.substring(0, 8)}
              </h2>
              <p className="mt-1 text-gray-500">
                Status:{' '}
                <span className="font-medium text-gray-900">{doc.status}</span>
              </p>
            </div>
            <div className="text-right text-gray-500">
              <p>{doc.branch.name}</p>
              <p>{doc.branch.phone}</p>
              <p>{doc.branch.email}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Items</h3>
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Item
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {doc.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                        {item.product.name}
                      </td>
                      <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-gray-500">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-right text-sm whitespace-nowrap text-gray-900">
                        ${Number(item.total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-8 flex justify-end">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>${Number(doc.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span>
                <span>${Number(doc.taxAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-3 text-lg font-medium text-gray-900">
                <span>Total</span>
                <span>${Number(doc.total).toFixed(2)}</span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between text-sm font-medium text-green-600">
                  <span>Paid</span>
                  <span>-${totalPaid.toFixed(2)}</span>
                </div>
              )}
              {totalPaid > 0 && (
                <div className="flex justify-between border-t border-gray-200 pt-3 text-lg font-medium text-gray-900">
                  <span>Balance Due</span>
                  <span>${remainingBalance.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {remainingBalance > 0 && doc.status !== 'CANCELLED' && (
            <div className="mt-8 flex justify-end border-t border-gray-200 pt-6">
              <a
                href={`/portal/${portalToken}/pay`}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
              >
                Pay Balance
              </a>
            </div>
          )}

          {doc.status === 'COMPLETED' && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="rounded-md bg-green-50 p-4 text-green-800">
                This invoice has been fully paid.
              </div>
            </div>
          )}
        </div>
      );
    }
  } catch (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-800">
        Unable to load document details. Please verify your access again or
        contact support.
      </div>
    );
  }
}
