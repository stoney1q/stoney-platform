import { ReactNode } from 'react';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-white py-4 shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-gray-900">
            Stoney Platform Portal
          </h1>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-grow px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="mt-auto border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} Stoney Platform. All rights
          reserved.
        </div>
      </footer>
    </div>
  );
}
