# Loop 36: CI/CD Pipeline & Deployment Strategy

This document outlines the GitHub Actions CI/CD implementation and the safe database migration deployment workflow for STONEY.

## CI/CD Workflow (`ci.yml`)
Runs on all Pull Requests targeting the `main` branch to validate code safety.
- **Migration Validation**: Runs `prisma migrate deploy` against a sterile, ephemeral PostgreSQL service container. Proves the migrations apply cleanly without touching real infrastructure.
- **Validation**: Executes `npm ci`, `npx prisma generate`, TypeScript compilation, and ESLint.
- **Testing**: Runs Vitest (Unit/Integration) and Playwright (E2E) connecting to a dedicated remote test database and using a seeded Firebase test user.
- **Build**: Verifies a successful `next build` before PR approval.

## Production Migration Workflow (`production-deploy.yml`)
Executes safely and sequentially after a Pull Request is merged into the `main` branch.
1. **Migration Execution**: Connects to the real Neon Production database and applies schema changes using `prisma migrate deploy`. This relies on PostgreSQL advisory locks and occurs *before* any Vercel deployment.
2. **Vercel Trigger**: After the migration succeeds, a POST request is sent to the Vercel Deploy Hook URL to spin up the actual Vercel build.

> [!WARNING]
> You must disable automatic GitHub integration deployments inside the Vercel Dashboard for this repository. If automatic deployments remain enabled, Vercel will race against the GitHub Actions migration job, potentially causing severe deployment crashes. Vercel should only deploy when triggered by the GitHub Actions Deploy Hook.

## Failure & Recovery Scenarios
- **If CI Fails (PR)**: The Pull Request is blocked from merging. Investigate GitHub Actions logs.
- **If Production Migration Fails**: The migration job fails, and the Vercel trigger is skipped. The live Vercel application continues running the old code and old schema. Human recovery is required to fix the migration (e.g. `prisma migrate resolve` or applying a fix via PR).
- **If Vercel Deployment Fails**: Vercel cancels the build. The previous deployment remains live. Investigate Vercel build logs.
- **If Smoke Verification Fails (Post-Deploy)**: Trigger a manual rollback inside the Vercel Dashboard to instantly revert to the previous deployment.

## Required GitHub Secrets & Configuration
The following configuration must be provisioned inside GitHub.

### 1. GitHub Environment: `production`
Manually create a GitHub Environment named `production`. This protects production-only secrets.
*Go to: Settings > Environments > New environment*

| Secret Name | Purpose | Classification |
|-------------|---------|----------------|
| `PROD_DATABASE_URL` | Neon Database connection string. | **High-Risk Secret** (Do not expose) |
| `VERCEL_DEPLOY_HOOK_URL` | Webhook URL to trigger Vercel deployment. | **Deployment Secret** |

### 2. Repository Secrets (Available to PRs)
Manually create these at the repository level to enable E2E testing.
*Go to: Settings > Secrets and variables > Actions*

| Secret Name | Purpose | Classification |
|-------------|---------|----------------|
| `TEST_DATABASE_URL` | Neon connection string for isolated E2E testing. | **E2E Credential** |
| `E2E_FIREBASE_TEST_EMAIL` | Seeded test user email. | **E2E Credential** |
| `E2E_FIREBASE_TEST_PASSWORD` | Seeded test user password. | **E2E Credential** |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public Firebase config. | **Public Configuration** |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public Firebase config. | **Public Configuration** |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public Firebase config. | **Public Configuration** |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public Firebase config. | **Public Configuration** |

## Required Future Vercel Configuration
- **Disable GitHub Integration Auto-Deployments**: Within Vercel, disable automatic deployments upon pushing to `main`.
- **Create a Deploy Hook**: Within Vercel, generate a new Git Hook url mapping to the `main` branch.
- **Environment Variables**: Populate all environment variables defined in `.env.example` directly into the Vercel UI. Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is carefully stringified on a single line to prevent newline corruption.

## Remaining Human Provisioning Steps
- Manually create the actual Vercel Project and Neon database clusters.
- Create the Vercel Deploy hook.
- Manually provision the Production and Test Firebase Projects.
- Populate the GitHub Environments and Secrets listed above.
