import 'server-only';
import {
  getApp,
  getApps,
  initializeApp,
  cert,
  applicationDefault,
  type App,
} from 'firebase-admin/app';

import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Build-time enforcement: the `server-only` import above will cause a
 * compilation error if this module is accidentally imported from a client
 * component. The runtime guard below provides additional defense-in-depth.
 */
if (typeof window !== 'undefined') {
  throw new Error('Firebase Admin SDK must only be loaded on the server.');
}

/**
 * Checks whether server-side Firebase Admin credentials are configured.
 */
export function isFirebaseAdminConfigured(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return true;
  }
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return true;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  return false;
}

/**
 * Resolves Firebase Admin credentials from environment variables:
 * 1. JSON string in FIREBASE_SERVICE_ACCOUNT_KEY
 * 2. Discrete environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * 3. Default application credentials via GOOGLE_APPLICATION_CREDENTIALS / GCP metadata server
 */
function getAdminCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return cert(parsed);
    } catch {
      throw new Error(
        'Invalid JSON format in FIREBASE_SERVICE_ACCOUNT_KEY environment variable.'
      );
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return cert({
      projectId,
      clientEmail,
      // Replace escaped newlines if private key was passed as a single-line string
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }

  throw new Error(
    'Firebase Admin credentials not found. Please provide FIREBASE_SERVICE_ACCOUNT_KEY, discrete FIREBASE_* variables, or GOOGLE_APPLICATION_CREDENTIALS.'
  );
}

/**
 * Lazily initializes and returns the server-side Firebase Admin App singleton instance.
 * Safe for Next.js hot-reload development and build-time static generation.
 */
export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const credential = getAdminCredential();
  const projectId = process.env.FIREBASE_PROJECT_ID;

  return initializeApp({
    credential,
    projectId: projectId || undefined,
  });
}

/**
 * Returns the server-side Firebase Admin Auth singleton instance.
 * Initializes the Admin app if not already initialized.
 */
export function getFirebaseAdminAuth(): Auth {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}
