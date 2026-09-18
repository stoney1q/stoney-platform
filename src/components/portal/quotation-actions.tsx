'use client';

import { useState } from 'react';
import {
  customerAcceptQuotation,
  customerRejectQuotation,
} from '@/lib/portal/actions';
import { useRouter } from 'next/navigation';

export function QuotationActions({
  portalToken,
  version,
}: {
  portalToken: string;
  version: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAction = async (action: 'accept' | 'reject') => {
    setLoading(true);
    setError(null);
    try {
      if (action === 'accept') {
        await customerAcceptQuotation(portalToken, version);
      } else {
        await customerRejectQuotation(portalToken, version);
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'DOCUMENT_MODIFIED') {
        setError(
          'This quotation has been updated by the store. Please refresh the page to view the latest version.'
        );
      } else {
        setError(message || 'An error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <h3 className="mb-4 text-lg font-medium text-gray-900">Actions</h3>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => handleAction('accept')}
          disabled={loading}
          className="flex-1 rounded-md bg-black px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Accept Quotation'}
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
