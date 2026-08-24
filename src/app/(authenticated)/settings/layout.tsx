import { requirePermission } from '@/lib/auth/guard';
import Link from 'next/link';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePermission('settings:read');

  const canManageBranches = user.permissions.includes('branches:read');
  const canManageStaff = user.permissions.includes('users:read');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-none p-6 pb-0">
        <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
        <div className="flex space-x-4 border-b">
          {canManageBranches && (
            <Link
              href="/settings/branches"
              className="px-1 py-2 text-sm font-medium hover:text-blue-600 focus:outline-none"
            >
              Branches
            </Link>
          )}
          {canManageStaff && (
            <Link
              href="/settings/staff"
              className="px-1 py-2 text-sm font-medium hover:text-blue-600 focus:outline-none"
            >
              Staff
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
