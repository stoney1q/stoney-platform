'use client';

import * as React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AuthenticatedUser } from '@/lib/auth/types';
import { NavigationItem } from '@/config/navigation';

interface AppShellProps {
  children: React.ReactNode;
  user: AuthenticatedUser;
  navigationItems: NavigationItem[];
}

export function AppShell({ children, user, navigationItems }: AppShellProps) {
  return (
    <div className="bg-muted/40 flex min-h-screen">
      <Sidebar user={user} items={navigationItems} />

      <div className="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-64">
        <Header user={user} items={navigationItems} />
        <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
      </div>
    </div>
  );
}
