'use client';

import { useState, useTransition } from 'react';
import { provisionStaff, updateStaff } from '@/lib/users/actions';

interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleId: string;
  branchId: string;
}

interface StaffFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staff?: StaffUser;
  branches: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

export function StaffFormDialog({
  isOpen,
  onClose,
  staff,
  branches,
  roles,
}: StaffFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEditing = !!staff;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateStaff(formData);
        } else {
          await provisionStaff(formData);
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-medium">
            {isEditing ? 'Edit Staff Member' : 'Provision Staff Member'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEditing && <input type="hidden" name="userId" value={staff.id} />}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                defaultValue={staff?.firstName}
                required
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Last Name *
              </label>
              <input
                type="text"
                name="lastName"
                defaultValue={staff?.lastName}
                required
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              defaultValue={staff?.email}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {!isEditing && (
              <p className="mt-1 text-xs text-gray-500">
                The employee must use this email to sign in via Firebase.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role *
            </label>
            <select
              name="roleId"
              defaultValue={staff?.roleId}
              required
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a role
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Branch *
            </label>
            <select
              name="branchId"
              defaultValue={staff?.branchId}
              required
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {isEditing && (
            <div className="flex items-center pt-2">
              <input type="hidden" name="isActive" value="false" />
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                value="true"
                defaultChecked={staff.isActive}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <label
                htmlFor="isActive"
                className="ml-2 block text-sm text-gray-900"
              >
                Active Account (Can log in)
              </label>
            </div>
          )}

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
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
              {isPending
                ? 'Saving...'
                : isEditing
                  ? 'Save Staff'
                  : 'Provision Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
