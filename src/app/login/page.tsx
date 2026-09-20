'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, error: authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
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

  const handleGoogleSubmit = async () => {
    setLocalError(null);
    setIsGoogleSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result.ok) {
        router.push('/');
        router.refresh();
      } else if (result.error) {
        setLocalError(result.error);
      }
    } catch {
      setLocalError('An unexpected error occurred during Google sign in.');
    } finally {
      setIsGoogleSubmitting(false);
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
            disabled={isSubmitting || isGoogleSubmitting}
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800/80"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-900/90 px-2 text-slate-400 backdrop-blur-md">Or</span>
          </div>
        </div>

        <button
          id="google-submit-btn"
          type="button"
          onClick={handleGoogleSubmit}
          disabled={isSubmitting || isGoogleSubmitting}
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGoogleSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
              Connecting...
            </span>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="border-t border-slate-800/80 pt-4 text-center text-xs text-slate-500">
          Protected by Firebase Authentication & Stoney RBAC Security
        </div>
      </div>
    </div>
  );
}
