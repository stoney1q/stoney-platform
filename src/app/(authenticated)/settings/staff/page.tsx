import { getStaff, getRolesForAssignment } from '@/lib/users/actions';
import { getBranches } from '@/lib/branches/actions';
import { requirePermission, getCurrentUser } from '@/lib/auth/guard';
import { StaffClient } from './staff-client';
import { redirect } from 'next/navigation';

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await requirePermission('users:read');

  const staff = await getStaff();

  // We need branches for the branch selector
  // Managers don't have branches:read by default to list all branches, but they don't need to assign to other branches anyway.
  // We will pass the branches they ARE allowed to assign to.
  // We can fetch all branches and let the frontend/backend enforce it, or we can fetch only allowed branches.
  let branches: { id: string; name: string }[] = [];
  try {
    branches = await getBranches();
  } catch {
    // If they can't list branches, they can only assign to their own branch
    branches = [user.branch];
  }

  const roles = await getRolesForAssignment();

  const canCreate = user.permissions.includes('users:create');
  const canUpdate = user.permissions.includes('users:update');

  // Filter roles based on what the current user can assign
  // We do a simple frontend filter for UX, backend still enforces it.
  const isSuperAdmin = user.role.name === 'Super Admin';
  const assignableRoles = roles
    .filter((role) => {
      if (isSuperAdmin) return true;
      if (role.name === 'Super Admin') return false;

      // User must have all permissions in the target role
      const targetPerms = role.rolePermissions.map((rp) => rp.permission.name);
      return targetPerms.every((p) => user.permissions.includes(p));
    })
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-medium">Manage Staff</h2>
      </div>
      <StaffClient
        initialStaff={staff}
        branches={branches}
        roles={assignableRoles}
        canCreate={canCreate}
        canUpdate={canUpdate}
        currentUserId={user.id}
      />
    </div>
  );
}
