import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guard';
import { getAuthorizedNavigation } from '@/config/navigation';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce authentication & retrieve authorized user context
  const user = await requireAuth();

  if (!user) {
    redirect('/login');
  }

  // Determine authorized navigation items for this user
  const permissions = user.permissions;
  const navigationItems = getAuthorizedNavigation(permissions);

  return (
    <AppShell user={user} navigationItems={navigationItems}>
      {children}
    </AppShell>
  );
}
