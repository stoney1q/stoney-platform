# LOOP 04 — CUSTOMER CRM FOUNDATION

## Objective

Design and implement a production-ready Customer domain to serve as the canonical customer identity layer for Sales, Quotations, Repairs, and future interactions. The implementation focuses strictly on the MVP without expanding into a full CRM platform or introducing external systems like Firestore/Elasticsearch.

## Architecture & Implementation

### 1. Database Model (`Customer`)

- **Canonical Identity**: Unique, auto-generated sequence number formatted as `CUS-000001` via PostgreSQL `SERIAL` (native `@default(autoincrement())`), mapped to a unique index (`sequence`). This is concurrency-safe and atomic.
- **Fields**: First name, last name, email (optional, unique if provided), phone (optional, unique if provided), alternate phone, address.
- **Security & Provenance**: Enforces soft deletes (`isActive` boolean) to protect referential integrity and historical data. Includes a `createdById` mapping securely to the creator `User` via the server session.
- **Rules**: At least one contact method (email or phone) is required per customer.

### 2. Actions & RBAC

- Built isolated server actions mapped to strict Role-Based Access Control (RBAC):
  - `createCustomer` (`customers:create`)
  - `updateCustomer` (`customers:update`)
  - `deactivateCustomer` (`customers:delete`)
  - `getCustomer` / `searchCustomers` (`customers:read`)
- All actions run on the server edge, securely protected by `requireAuth` and `requirePermission`.

### 3. Duplicate Detection

- A lightweight, database-level matching system alerts users to potential duplicates when creating or updating customers.
- Emits a non-blocking `CustomerDuplicateWarning` containing exact matches by email or phone.

### 4. Search & UI

- Integrated a flexible search action (`searchCustomers`) supporting fast matching across customer numbers, names, emails, and phone numbers.
- Deployed `/customers` route including a data table, filtering, and a unified customer creation/editing form.
- The UI handles the `warning` response to prompt users before saving duplicates.

## Verification

- Customer domain tests ensure strict validation, safe sequence handling, and RBAC isolation (13/13 passing).
- Safe integration alongside Authentication and Inventory domains. Test cleanup hooks in other domains were updated to account for new referential integrity protections on `User`.
- No PII is logged to external providers.
