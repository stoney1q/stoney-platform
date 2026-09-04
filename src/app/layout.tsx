import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/context';
import { getCurrentUser } from '@/lib/auth/guard';
import { CopilotDrawer } from '@/components/ui/copilot/copilot-drawer';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Stoney Platform — Enterprise Management',
  description:
    'Enterprise Business Management Platform for Stoney IT Solutions',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-950 text-slate-100">
        <AuthProvider initialUser={currentUser}>
          {children}
          {currentUser?.permissions.includes('ai:access') && <CopilotDrawer />}
        </AuthProvider>
      </body>
    </html>
  );
}
