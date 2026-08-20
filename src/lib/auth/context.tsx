'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useTransition,
} from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onIdTokenChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirebaseClientAuth,
  isFirebaseClientConfigured,
} from '@/lib/firebase/client';
import type { AuthenticatedUser } from '@/lib/auth/types';

interface AuthContextType {
  user: AuthenticatedUser | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  signIn: (
    email: string,
    pass: string
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthenticatedUser | null;
}) {
  const [user, setUser] = useState<AuthenticatedUser | null>(initialUser);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !initialUser && isFirebaseClientConfigured()
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Listen to Firebase client auth state changes
  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      return;
    }

    try {
      const auth = getFirebaseClientAuth();
      const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);
        if (!fbUser) {
          setUser(null);
          setIsLoading(false);
        } else {
          // Token refreshed or user signed in — synchronize with server session
          try {
            const idToken = await fbUser.getIdToken();
            const res = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
            if (res.ok) {
              const data = await res.json();
              setUser(data.user);
            }
          } catch {
            // Ignore background sync errors
          } finally {
            setIsLoading(false);
          }
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firebase client auth initialization skipped:', err);
    }
  }, []);

  const signIn = async (email: string, pass: string) => {
    setError(null);
    if (!isFirebaseClientConfigured()) {
      const errMsg =
        'Firebase client is not configured. Please set NEXT_PUBLIC_FIREBASE_* environment variables.';
      setError(errMsg);
      return { ok: false, error: errMsg };
    }

    try {
      const auth = getFirebaseClientAuth();
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        pass
      );
      const idToken = await credential.user.getIdToken();

      // Exchange ID token for secure server session cookie
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const sessionData = await sessionRes.json();

      if (!sessionRes.ok) {
        const errMsg =
          sessionData.error || 'Failed to establish application session';
        setError(errMsg);
        // Sign out of client if server provisioning failed
        await firebaseSignOut(auth);
        return { ok: false, error: errMsg };
      }

      startTransition(() => {
        setUser(sessionData.user);
        setFirebaseUser(credential.user);
      });

      return { ok: true };
    } catch (err: unknown) {
      let errMsg = 'Failed to sign in. Please check your credentials.';
      if (err instanceof Error) {
        if (
          err.message.includes('auth/invalid-credential') ||
          err.message.includes('auth/user-not-found') ||
          err.message.includes('auth/wrong-password')
        ) {
          errMsg = 'Invalid email or password.';
        } else if (err.message.includes('auth/too-many-requests')) {
          errMsg = 'Too many failed attempts. Please try again later.';
        } else {
          errMsg = err.message;
        }
      }
      setError(errMsg);
      return { ok: false, error: errMsg };
    }
  };

  const signOut = async () => {
    try {
      if (isFirebaseClientConfigured()) {
        const auth = getFirebaseClientAuth();
        await firebaseSignOut(auth);
      }
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setFirebaseUser(null);
    }
  };

  const sendPasswordReset = async (email: string) => {
    if (!isFirebaseClientConfigured()) {
      return { ok: false, error: 'Firebase client is not configured.' };
    }
    try {
      const auth = getFirebaseClientAuth();
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true };
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Failed to send password reset email.';
      return { ok: false, error: errMsg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        signIn,
        signOut,
        sendPasswordReset,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
