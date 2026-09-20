# Loop 36: Stage C.1 Infrastructure Preparation

This checklist details the exact external resources required to bring the STONEY Platform to a live production state, explicitly documenting all environment variables, public vs. secret constraints, and manual configuration required.

## 1. Database (Neon Serverless PostgreSQL)
**Configuration**: Standard connection using `@neondatabase/serverless` for edge/node compatibility.
- **Resource Required**: A production Neon Project and isolated Database.
- **Environment Variables**:
  - `DATABASE_URL` (Secret): Full connection string (must include `sslmode=require`).
- **Post-Provision Verification**: Ensure `npx prisma migrate deploy` executes cleanly via the GitHub Actions deployment pipeline.

## 2. Authentication (Firebase)
**Configuration**: Firebase Client SDK for browser interaction and Firebase Admin SDK for server-side cookie verification.
- **Resource Required**: A production Firebase Project.
- **Environment Variables**:
  - `NEXT_PUBLIC_FIREBASE_API_KEY` (Public)
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (Public)
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (Public)
  - `NEXT_PUBLIC_FIREBASE_APP_ID` (Public)
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (Public)
  - `FIREBASE_SERVICE_ACCOUNT_KEY` (Secret): JSON blob from the GCP IAM dashboard stringified onto a single line.
- **Post-Provision Verification**: Test signing in via the deployed Vercel frontend.

## 3. Storage (Google Cloud Storage via Firebase)
**Configuration**: Handled by the Firebase Admin SDK.
- **Resource Required**: A default Firebase Storage bucket (which provisions a GCS bucket).
- **Security Rules/IAM Requirements**: 
  - `public/products/` prefix MUST allow unauthenticated read access (`allUsers` Viewer).
  - `private/branches/` prefix MUST remain highly restricted, relying entirely on the server-side generated Signed URLs.
- **Post-Provision Verification**: Upload a product image and verify it is publicly accessible via the raw storage URL.

## 4. Payments (Paystack)
**Configuration**: Paystack Popup for browser payments, Paystack Webhooks for backend verification.
- **Resource Required**: A live Paystack business account.
- **Environment Variables**:
  - `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (Public)
  - `PAYSTACK_SECRET_KEY` (Secret)
- **Manual Configuration**: The Paystack Dashboard must be configured to point webhooks to `https://<production-domain>/api/webhooks/paystack`.
- **Post-Provision Verification**: Execute a live transaction (or live test transaction) and ensure the webhook correctly marks the invoice as Paid.

## 5. Email (Resend)
**Configuration**: Resend Node.js SDK.
- **Resource Required**: A Resend account.
- **Environment Variables**:
  - `RESEND_API_KEY` (Secret)
- **Manual Configuration**: Must verify the production domain inside the Resend Dashboard (DNS records).
- **Post-Provision Verification**: Send a test invoice to verify inbox delivery.

## 6. Hosting (Vercel)
**Configuration**: Node.js Next.js Runtime.
- **Resource Required**: A Vercel Project.
- **Environment Variables**:
  - `PORTAL_JWT_SECRET` (Secret): Minimum 32 characters of high-entropy data.
  - `CRON_SECRET` (Secret): Used to protect the `/api/cron/process-emails` endpoint.
- **Manual Configuration**: 
  - **Node.js**: Verify the project is set to Node 20.
  - **Git Deployments**: Disable automatic GitHub branch deployments in the settings. Deployment must rely exclusively on the webhook triggered by GitHub Actions.
  - **Cron**: Configure `vercel.json` if necessary, or setup Vercel Cron in the dashboard pointing to `/api/cron/process-emails`.
- **Post-Provision Verification**: Check `/api/health` returns 200 OK.
