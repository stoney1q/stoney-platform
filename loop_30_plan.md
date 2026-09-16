# Loop 30 Implementation Plan: Public Customer Portal (AMENDED)

This plan implements the Public Customer Portal for Repair Tracking and Quotation Approval, adhering strictly to the amended Loop 30 adversarial architecture and security review findings.

## 1. Prisma Schema & Migration

### [MODIFY] `prisma/schema.prisma`

- **Quotation Model**:
  - Add `portalToken String @unique @default(uuid())`
  - Add `version Int @default(1)`
- **Repair Model**:
  - Add `portalToken String @unique @default(uuid())`
- **Generate Migration**: Run `npx prisma migrate dev --name add_portal_tokens_and_concurrency`

_Backwards Compatibility_: All existing Quotation and Repair records will automatically receive a UUID `portalToken` and `version: 1` upon migration due to `@default`.

## 2. Security & Verification Foundation

### [MODIFY] `.env.example`

- **[NEW]** Add `PORTAL_JWT_SECRET` (Must be a 32+ character high-entropy random string). This must not reuse existing secrets (like `NEXTAUTH_SECRET`) and must not be generated dynamically at runtime to ensure sessions persist across restarts.

### [NEW] `src/lib/portal/auth.ts`

- Implement robust startup/runtime validation to throw an explicit error if `PORTAL_JWT_SECRET` is missing or < 32 characters.
- Implement `signPortalToken(documentId: string, type: 'QUOTATION' | 'REPAIR', portalToken: string): Promise<string>` using `jose` (`SignJWT`).
  - Set strict expiration to 2 hours (`setExpirationTime('2h')`).
- Implement `verifyPortalCookie(): Promise<JwtPayload | null>` using `jose` (`jwtVerify`).
  - Read the `stoney_portal_session` cookie securely via `next/headers`.
- **Timing-Safe Comparison**:
  - Implement a `secureCompare(input: string, stored: string | null)` function.
  - To prevent length-mismatch errors and timing leaks, the function must:
    1. Coalesce a `null` stored value to a static random UUID generated once at server startup.
    2. Hash both the input and the coalesced stored value using `crypto.createHash('sha256')`.
    3. Compare the two resulting fixed-length (32-byte) buffers using `crypto.timingSafeEqual`.

### [NEW] `src/lib/portal/rate-limit.ts`

- Implement **two** distinct rate limiters for the verification endpoint:
  1. **IP-Based Limiter**: Keyed by `${ip}` to prevent a single IP from sweeping tokens (e.g., 5 attempts per 15 minutes).
  2. **Token-Based Global Limiter**: Keyed globally by `${portalToken}` to prevent distributed IP-rotation brute-forcing. If this threshold is hit (e.g., 10 failed attempts per hour across ALL IPs), the token is temporarily locked.
- **Lockout Behavior**: Subsequent verification attempts during a lockout return the same generic HTTP 200 response to the attacker, but internally refuse to issue a cookie.
- **Staff Alert**: Emits an audit log/system note (`[SECURITY] High volume of failed access attempts for this document`) to alert staff of potential brute-forcing.

## 3. Server Actions & Mutations

### [NEW] `src/lib/portal/actions.ts`

- **`verifyPortalAccess(portalToken: string, contactDetail: string)`**
  - Looks up Quotation or Repair by `portalToken`.
  - Checks rate limits via IP and global `portalToken`. If locked, returns generic response immediately.
  - **Phone Normalization**: Both `contactDetail` and `Customer.phone` must be stripped of all non-numeric characters (regex `/\D/g`) before comparison.
  - Email Normalization: Strip whitespace and lowercase.
  - Uses `secureCompare` (SHA256 + timingSafeEqual) against both email and normalized phone.
  - **Always returns generic response**: "If the details match, you will be granted access."
  - On success, signs the JWT and sets the HTTP-only, secure `stoney_portal_session` cookie via `cookies().set()`.
  - Logs audit event: `[PORTAL] Customer verification attempt successful/failed`.

- **`getPortalDocument(portalToken: string)`**
  - Requires valid JWT cookie.
  - Returns heavily sanitized payload (Customer firstName/lastName only, Status, Items, Totals, RepairLogs).

- **`customerAcceptQuotation(portalToken: string, expectedVersion: number)`**
  - Requires valid JWT cookie.
  - Fetches `Quotation`.
  - Ensures `status === QuotationStatus.SENT` or `DRAFT`.
  - Executes Prisma `$transaction`:
    - `where: { id: quotation.id, version: expectedVersion }`
    - `data: { status: QuotationStatus.ACCEPTED, version: { increment: 1 } }`
  - Creates Audit Log / System Note indicating customer acceptance via Portal.

- **`customerRejectQuotation(portalToken: string, expectedVersion: number)`**
  - Identical concurrency constraints, transitions to `REJECTED`.

### [MODIFY] `src/lib/quotations/actions.ts`

- Update all existing internal quotation mutations to use the new `version` field for optimistic concurrency.

## 4. UI Components & Pages

### [NEW] `src/app/portal/[portalToken]/layout.tsx`

- Minimalist, mobile-first layout. No internal navigation bars or sidebars.

### [NEW] `src/app/portal/[portalToken]/page.tsx`

- **React Server Component**. Checks for `stoney_portal_session` cookie and renders the Verification View or Document View.

### [NEW] `src/components/portal/quotation-actions.tsx`

- Client component with "Approve" and "Decline" buttons.
- **Concurrency UX**: Catches optimistic concurrency errors (e.g., Prisma `P2025` mapped to a custom server error). If detected, displays a user-friendly UI message: _"This quotation has been updated by the store. Please refresh the page to view the latest version."_

## 5. Email Integration

### [MODIFY] `src/lib/documents/email.ts`

- Query the `portalToken` for the document.
- Inject a prominent "View & Track Online" CTA button in the HTML email template pointing to `${process.env.NEXT_PUBLIC_APP_URL}/portal/${doc.portalToken}`.

## 6. Testing Strategy

### [NEW] `src/lib/portal/portal.integration.test.ts`

- **Adversarial Verification Tests**:
  - Assert that `verifyPortalAccess` takes exactly the same amount of time and returns identical responses when contact length is wrong, correct, or when the Customer record has `null` values.
  - Assert that stripping non-numeric characters allows `(555) 123-4567` to successfully verify against `+1 555 123 4567`.
- **Distributed Rate Limit Tests**:
  - Simulate 11 verification attempts against the same `portalToken` from 11 different mocked IPs, ensuring the global token limiter triggers and blocks the 11th attempt.
- **Concurrency & UX Tests**:
  - Simulate concurrent `customerAcceptQuotation` and `convertQuotationToSale`.
  - Verify `version` mismatch throws the designated concurrency error and that the UI handles it gracefully.
- **JWT Secret Tests**:
  - Assert that the server refuses to sign/verify if `PORTAL_JWT_SECRET` is missing.
- **Branch Isolation Tests**:
  - Verify that a valid token for `QUO-1` cannot access `QUO-2`.

## 7. Required Packages

- `jose`: For edge-compatible JWT signing and verification.

## 8. Explicit Out-of-Scope Items

- Online Invoice Payment (Stripe).
- SMS Delivery.
- Magic link one-click logins.
- Modification of Customer details via the portal.

---

**PLAN AMENDED — READY FOR IMPLEMENTATION**
