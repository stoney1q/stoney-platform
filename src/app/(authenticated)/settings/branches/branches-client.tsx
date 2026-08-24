'use client';

import { useState } from 'react';
import { BranchFormDialog } from './branch-form-dialog';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

interface BranchesClientProps {
  initialBranches: Branch[];
  canCreate: boolean;
  canUpdate: boolean;
}

export function BranchesClient({
  initialBranches,
  canCreate,
  canUpdate,
}: BranchesClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | undefined>(
    undefined
  );

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingBranch(undefined);
    setIsDialogOpen(true);
  };

  return (
    <div>
      {canCreate && (
        <div className="mb-4">
          <button
            onClick={handleCreate}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Branch
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="px-6 py-3 font-medium text-gray-500">Code</th>
              <th className="px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="px-6 py-3 font-medium text-gray-500">Address</th>
              {canUpdate && (
                <th className="px-6 py-3 text-right font-medium text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {initialBranches.map((branch) => (
              <tr key={branch.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{branch.name}</td>
                <td className="px-6 py-4">{branch.code}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      branch.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {branch.address || '-'}
                </td>
                {canUpdate && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(branch)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {initialBranches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No branches found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BranchFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        branch={editingBranch}
      />
    </div>
  );
}
