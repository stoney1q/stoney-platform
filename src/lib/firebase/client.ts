import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase Client Configuration
 * Sourced strictly from public environment variables (NEXT_PUBLIC_FIREBASE_*).
 * Never hard-code credentials.
 */
export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * Checks whether minimum required client configuration environment variables are present.
 */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    firebaseClientConfig.apiKey &&
    firebaseClientConfig.authDomain &&
    firebaseClientConfig.projectId &&
    firebaseClientConfig.appId
  );
}

/**
 * Lazily initializes and returns the client-side FirebaseApp singleton instance.
 * Safe for SSR, Next.js client hydration, and build-time static generation.
 */
export function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  if (!isFirebaseClientConfigured()) {
    throw new Error(
      'Firebase client configuration is missing required environment variables (NEXT_PUBLIC_FIREBASE_*).'
    );
  }

  return initializeApp(firebaseClientConfig);
}

/**
 * Returns the client-side FirebaseAuth singleton instance.
 * Initializes the Firebase app if not already initialized.
 */
export function getFirebaseClientAuth(): Auth {
  const app = getFirebaseClientApp();
  return getAuth(app);
}
