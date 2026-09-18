import { getPortalDocument } from '@/lib/portal/actions';
import { verifyTransaction } from '@/lib/paystack/client';

export default async function PortalSuccessPage({
  params,
  searchParams,
}: {
  params: { portalToken: string };
  searchParams: { reference?: string; trxref?: string };
}) {
  const { portalToken } = params;
  const reference = searchParams.reference || searchParams.trxref;

  // We fetch the document just to ensure they are authenticated
  const data = await getPortalDocument(portalToken);
  const doc = data.document;

  if (!doc) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-800">
        Document not found.
      </div>
    );
  }

  let isVerified = false;
  let verificationError = '';

  if (reference) {
    try {
      const txData = await verifyTransaction(reference);

      if (txData.status === 'success') {
        const metadata = txData.metadata as Record<string, unknown>;

        if (
          !metadata ||
          metadata.portalToken !== portalToken ||
          metadata.saleId !== doc.id
        ) {
          verificationError =
            'Transaction metadata does not match this invoice.';
        } else {
          isVerified = true;
        }
      } else {
        verificationError = `Transaction status is ${txData.status}.`;
      }
    } catch (error) {
      verificationError =
        'Could not verify transaction with the payment provider.';
      console.error('Paystack Verification Error on Success Page:', error);
    }
  } else {
    verificationError = 'No transaction reference found.';
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 text-center shadow sm:p-8">
      {isVerified ? (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Payment Successful!
          </h2>
          <p className="mb-8 text-gray-500">
            Thank you for your payment. Your transaction has been securely
            processed by Paystack. It may take a few moments for the status to
            update on your invoice.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Payment Verification Failed
          </h2>
          <p className="mb-8 text-gray-500">
            {verificationError ||
              'We could not verify your payment at this time.'}
          </p>
        </>
      )}
      <a
        href={`/portal/${portalToken}`}
        className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-100 px-4 py-2 font-medium text-indigo-700 hover:bg-indigo-200"
      >
        Return to Invoice
      </a>
    </div>
  );
}
