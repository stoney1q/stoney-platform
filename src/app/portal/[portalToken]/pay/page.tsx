import { getPortalDocument } from '@/lib/portal/actions';
import { createPaystackCheckoutSession } from '@/lib/paystack/actions';
import { redirect } from 'next/navigation';

export default async function PortalPaymentPage({
  params,
}: {
  params: { portalToken: string };
}) {
  const { portalToken } = params;

  // We fetch the document to display a summary.
  // getPortalDocument verifies the JWT cookie.
  const data = await getPortalDocument(portalToken);

  if (data.type !== 'SALE' || !data.document) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-800">
        Only finalized sales can be paid through the portal.
      </div>
    );
  }

  const doc = data.document;
  if (!('payments' in doc) || !('total' in doc)) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-800">
        Invalid document format.
      </div>
    );
  }

  if (doc.status === 'COMPLETED') {
    return (
      <div className="rounded-md bg-green-50 p-4 text-green-800">
        This invoice has already been fully paid.
      </div>
    );
  }

  if (doc.status === 'CANCELLED') {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-800">
        This invoice has been cancelled.
      </div>
    );
  }

  const totalPaid = doc.payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const remainingBalance = Number(doc.total) - totalPaid;

  if (remainingBalance <= 0) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-green-800">
        This invoice has already been fully paid.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow sm:p-8">
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Payment Summary</h2>

      <div className="mb-8 rounded-md bg-gray-50 p-4">
        <div className="flex justify-between border-b border-gray-200 py-2">
          <span className="text-gray-600">Invoice Total</span>
          <span className="font-medium text-gray-900">
            GHS {Number(doc.total).toFixed(2)}
          </span>
        </div>
        {totalPaid > 0 && (
          <div className="flex justify-between border-b border-gray-200 py-2">
            <span className="text-gray-600">Amount Already Paid</span>
            <span className="font-medium text-green-600">
              -GHS {totalPaid.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between py-4 text-lg font-bold">
          <span className="text-gray-900">Amount Due Now</span>
          <span className="text-gray-900">
            GHS {remainingBalance.toFixed(2)}
          </span>
        </div>
      </div>

      <p className="mb-6 text-sm text-gray-500">
        You will be redirected to our secure payment partner, Paystack, to
        complete your transaction.
      </p>

      <form
        action={async () => {
          'use server';
          const { authorizationUrl } =
            await createPaystackCheckoutSession(portalToken);
          if (authorizationUrl) redirect(authorizationUrl);
        }}
      >
        <button
          type="submit"
          className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
        >
          Pay GHS {remainingBalance.toFixed(2)} Securely
        </button>
      </form>

      <div className="mt-4 text-center">
        <a
          href={`/portal/${portalToken}`}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Return to Invoice Details
        </a>
      </div>
    </div>
  );
}
