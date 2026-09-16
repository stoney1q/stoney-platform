'use client';

import { useState } from 'react';
import { verifyPortalAccess } from '@/lib/portal/actions';

export function VerificationForm({ portalToken }: { portalToken: string }) {
  const [contactDetail, setContactDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactDetail) return;

    setLoading(true);
    setMessage('');

    try {
      const res = await verifyPortalAccess(portalToken, contactDetail);
      if (res.success) {
        setMessage(res.message);
        // Refresh the page so the server component can read the new cookie
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setMessage('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Access Document</h2>
      <p className="mb-6 text-gray-600">
        Please enter the email address or phone number associated with this
        document to verify your identity.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="contact"
            className="block text-sm font-medium text-gray-700"
          >
            Email or Phone Number
          </label>
          <input
            type="text"
            id="contact"
            name="contact"
            required
            value={contactDetail}
            onChange={(e) => setContactDetail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-black focus:ring-black sm:text-sm"
            placeholder="e.g. name@example.com or 555-1234"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center rounded-md border border-transparent bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:ring-2 focus:ring-black focus:ring-offset-2 focus:outline-none disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify Access'}
        </button>
      </form>
      {message && (
        <p className="mt-4 text-center text-sm text-gray-500">{message}</p>
      )}
    </div>
  );
}
