'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import {
  ShieldCheck,
  LogIn,
  LogOut,
  User,
  Building2,
  Key,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

export default function Home() {
  const { user, isLoading, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">
                Stoney Platform
              </span>
              <span className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
                v0.1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-800" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="hidden flex-col text-right sm:flex">
                  <span className="text-xs font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-[10px] font-medium text-cyan-400">
                    {user.role.name} • {user.branch.name}
                  </span>
                </div>
                <button
                  id="signout-btn"
                  onClick={() => signOut()}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero / Main Section */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Firebase Authentication & PostgreSQL RBAC Architecture</span>
          </div>

          <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-white sm:text-5xl">
            Enterprise Business Management Platform
          </h1>

          <p className="text-base leading-relaxed text-slate-400 sm:text-lg">
            Scalable multi-branch operations, fine-grained role-based access
            control, repairs, inventory, sales, and quotations management for
            Stoney IT Solutions.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {user ? (
              <div className="w-full space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <User className="h-4 w-4 text-cyan-400" />
                    Authenticated Session Context
                  </h3>
                  <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-400">
                    Active Session
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                  <div className="space-y-1 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <User className="h-3.5 w-3.5 text-cyan-400" />
                      User Profile
                    </div>
                    <div className="font-semibold text-white">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="truncate font-mono text-[11px] text-slate-500">
                      {user.email}
                    </div>
                  </div>

                  <div className="space-y-1 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Building2 className="h-3.5 w-3.5 text-cyan-400" />
                      Branch
                    </div>
                    <div className="font-semibold text-white">
                      {user.branch.name}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      Code: {user.branch.code}
                    </div>
                  </div>

                  <div className="space-y-1 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Key className="h-3.5 w-3.5 text-cyan-400" />
                      Role & Permissions
                    </div>
                    <div className="font-semibold text-white">
                      {user.role.name}
                    </div>
                    <div className="font-mono text-[11px] text-cyan-400">
                      {user.permissions.length} active permissions
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-500/20 transition-all hover:bg-cyan-400 hover:shadow-cyan-500/30"
              >
                <span>Access Management Console</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        Stoney Platform © {new Date().getFullYear()} Stoney IT Solutions. All
        rights reserved.
      </footer>
    </div>
  );
}
