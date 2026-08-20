'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, error: authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('Please provide both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result.ok) {
        router.push('/');
        router.refresh();
      } else if (result.error) {
        setLocalError(result.error);
      }
    } catch {
      setLocalError('An unexpected error occurred during sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-md">
        <div className="space-y-2 text-center">
          <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Stoney Platform
          </h1>
          <p className="text-sm text-slate-400">
            Enterprise Business Management System
          </p>
        </div>

        {displayError && (
          <div
            role="alert"
            className="animate-in fade-in flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
            <div className="flex-1 font-medium">{displayError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-semibold tracking-wider text-slate-300 uppercase"
            >
              Work Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@stoney.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-4 pl-11 text-sm text-slate-100 placeholder-slate-600 transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-semibold tracking-wider text-slate-300 uppercase"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-4 pl-11 text-sm text-slate-100 placeholder-slate-600 transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400 hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                Authenticating...
              </span>
            ) : (
              <>
                <span>Sign in to Platform</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-800/80 pt-4 text-center text-xs text-slate-500">
          Protected by Firebase Authentication & Stoney RBAC Security
        </div>
      </div>
    </div>
  );
}
