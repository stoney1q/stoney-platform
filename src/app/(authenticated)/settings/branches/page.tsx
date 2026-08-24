import { getBranches } from '@/lib/branches/actions';
import { requirePermission } from '@/lib/auth/guard';
import { BranchesClient } from './branches-client';

export default async function BranchesPage() {
  const user = await requirePermission('branches:read');
  const branches = await getBranches();

  const canCreate = user.permissions.includes('branches:create');
  const canUpdate = user.permissions.includes('branches:update');

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-medium">Manage Branches</h2>
      </div>
      <BranchesClient
        initialBranches={branches}
        canCreate={canCreate}
        canUpdate={canUpdate}
      />
    </div>
  );
}
