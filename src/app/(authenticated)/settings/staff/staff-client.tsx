'use client';

import { useState } from 'react';
import { StaffFormDialog } from './staff-form-dialog';

interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  emailVerified: boolean;
  roleId: string;
  branchId: string;
  role: { id: string; name: string };
  branch: { id: string; name: string };
}

interface StaffClientProps {
  initialStaff: StaffUser[];
  branches: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  canCreate: boolean;
  canUpdate: boolean;
  currentUserId: string;
}

export function StaffClient({
  initialStaff,
  branches,
  roles,
  canCreate,
  canUpdate,
  currentUserId,
}: StaffClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | undefined>(
    undefined
  );

  const handleEdit = (staff: StaffUser) => {
    setEditingStaff(staff);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingStaff(undefined);
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
            Provision Staff
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="px-6 py-3 font-medium text-gray-500">Email</th>
              <th className="px-6 py-3 font-medium text-gray-500">Role</th>
              <th className="px-6 py-3 font-medium text-gray-500">Branch</th>
              <th className="px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="px-6 py-3 font-medium text-gray-500">Verified</th>
              {canUpdate && (
                <th className="px-6 py-3 text-right font-medium text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {initialStaff.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">
                  {staff.firstName} {staff.lastName}
                </td>
                <td className="px-6 py-4">{staff.email}</td>
                <td className="px-6 py-4">{staff.role?.name || 'None'}</td>
                <td className="px-6 py-4">{staff.branch?.name || 'None'}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      staff.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {staff.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {staff.emailVerified ? (
                    <span className="text-xs font-medium text-green-600">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">No</span>
                  )}
                </td>
                {canUpdate && (
                  <td className="px-6 py-4 text-right">
                    {staff.id !== currentUserId && (
                      <button
                        onClick={() => handleEdit(staff)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                    )}
                    {staff.id === currentUserId && (
                      <span className="text-sm text-gray-400">You</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {initialStaff.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No staff members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <StaffFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        staff={editingStaff}
        branches={branches}
        roles={roles}
      />
    </div>
  );
}
