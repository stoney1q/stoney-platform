'use client';

import { useState, useTransition } from 'react';
import { createBranch, updateBranch } from '@/lib/branches/actions';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

interface BranchFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  branch?: Branch;
}

export function BranchFormDialog({
  isOpen,
  onClose,
  branch,
}: BranchFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEditing = !!branch;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateBranch(formData);
        } else {
          await createBranch(formData);
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-medium">
            {isEditing ? 'Edit Branch' : 'Create Branch'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEditing && (
            <input type="hidden" name="branchId" value={branch.id} />
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              name="name"
              defaultValue={branch?.name}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Downtown Store"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Code * (Max 10 chars)
            </label>
            <input
              type="text"
              name="code"
              defaultValue={branch?.code}
              required
              maxLength={10}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. DT01"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Address
            </label>
            <textarea
              name="address"
              defaultValue={branch?.address || ''}
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <div className="flex items-center">
            <input
              type="hidden"
              name="isActive"
              value="false" // fallback if unchecked
            />
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              value="true"
              defaultChecked={branch ? branch.isActive : true}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label
              htmlFor="isActive"
              className="ml-2 block text-sm text-gray-900"
            >
              Active (Available for operations)
            </label>
          </div>

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
