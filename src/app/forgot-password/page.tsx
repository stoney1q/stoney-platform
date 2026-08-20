'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import {
  Mail,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your work email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendPasswordReset(email);
      if (result.ok) {
        setIsSuccess(true);
      } else {
        setError(result.error || 'Failed to send password reset email.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-md">
        <div className="space-y-2 text-center">
          <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
            <KeyRound className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Reset Password
          </h1>
          <p className="text-sm text-slate-400">
            Enter your email to receive a password reset link
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="animate-in fade-in flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {isSuccess ? (
          <div className="animate-in fade-in space-y-6">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-200">
                  Reset instructions sent
                </p>
                <p className="mt-1 text-xs text-emerald-300/90">
                  If an account exists for{' '}
                  <span className="font-mono text-white">{email}</span>, you
                  will receive an email with instructions to reset your
                  password.
                </p>
              </div>
            </div>

            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        ) : (
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

            <button
              id="reset-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400 hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  Sending Link...
                </span>
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
