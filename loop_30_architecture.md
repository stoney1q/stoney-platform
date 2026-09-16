# DOMAIN DEPENDENCY REVIEW & ARCHITECTURE

_(Loop 30: Public Customer Portal - AMENDED)_

# CURRENT STATE

STONEY possesses a complete internal capability set for retail and repair operations. Through Loop 28 (Document Generation) and Loop 29 (Email Delivery), the system can dispatch professional PDFs to customers. However, the system lacks any mechanism for customers to independently interact with the business (e.g., tracking a repair or approving a quotation).

# DEPENDENCIES

- **Loop 28 (Documents)**: PDF generation will still use `documentNumber`. However, public links will now use a cryptographically unguessable token.
- **Loop 29 (Email)**: Email templates must be updated to include the portal URL populated with the new token.
- **Prisma Schema**: Requires schema modifications for `Repair` and `Quotation`.

# DOMAIN BOUNDARIES

The **Portal Domain** sits entirely outside the `(authenticated)` route group. It is the sole public-facing interface for STONEY end-customers (the retail clients of the repair shops). It interacts with the `Repairs` and `Quotations` domains through strictly guarded, limited-access server actions that enforce verification-based authorization and strict optimistic concurrency.

# SCHEMA CHANGES & DATA MODEL

To prevent Insecure Direct Object Reference (IDOR) and race conditions, we are modifying the Prisma schema:

1. **`portalToken` (String @unique @default(uuid()))**: Added to both `Repair` and `Quotation` models. This guarantees that public URLs are unguessable and eliminates enumeration attacks based on sequential `documentNumber`s.
2. **`version` (Int @default(1))**: Added to the `Quotation` model. This brings `Quotation` into alignment with the `Repair` model's existing optimistic concurrency controls. All quotation mutations (both staff and customer) will now require a version check.

_Note: Existing `Quotation` records will receive a default `version` of 1 and a generated UUID `portalToken` upon migration._

# SECURITY MODEL & VERIFICATION FLOW

1. **Routing**: Customers navigate to `/portal/[portalToken]`. This URL completely obfuscates the `documentNumber` and branch origin.
2. **Verification Challenge**:
   - The token alone does not grant access. The portal will prompt the user to verify their identity using the email address or phone number associated with the `Customer` record.
   - **Generic Responses**: The `verifyPortalAccess` endpoint must return a constant-time, generic HTTP 200 response (e.g., "If the details match, you will be granted access") whether the `portalToken` exists or the credentials are wrong. This prevents timing attacks and information disclosure.
3. **Cookie/Session Security**:
   - Upon successful verification, the server issues an HTTP-only, secure JWT cookie.
   - **Strict TTL**: The JWT expires strictly in 2 hours (`exp` claim).
   - **Scope**: The JWT is strictly scoped to the specific `portalToken`.
   - **Revocation**: The JWT must include the `documentId` and current `version` or status. If the document status transitions to `CANCELLED` or `CONVERTED` (for Quotations), or if the staff manually revokes access, any subsequent mutations using that cookie will fail.
4. **Rate Limiting**:
   - The verification endpoint is aggressively rate-limited (e.g., 5 attempts per minute) keyed by a combination of IP Address AND `portalToken`.

# AUTHORIZATION & BRANCH ISOLATION

- **View Authorization**: The `getPortalDocument` server action validates the JWT. It only returns the data necessary for the customer (e.g., sanitized items, totals, status). It does not leak internal notes or supplier costs.
- **Cross-Branch Isolation**: Since the JWT is scoped purely to a single `portalToken`, a verified customer can only view the specific document they were linked to. They cannot traverse to other documents for that customer, nor any documents from other branches.
- **Mutation Authorization**: The `customerAcceptQuotation` and `customerRejectQuotation` actions strictly require the valid scoped JWT.

# CONCURRENCY MODEL

**Approval vs. Cancel/Convert Races**:
The addition of `version` to the `Quotation` model ensures atomic transitions.
If a customer clicks "Approve" via the Portal at the exact millisecond a staff member clicks "Cancel" or "Convert to Sale" in the POS:

- The Prisma `$transaction` leverages `where: { id: id, version: version }`.
- Only one request will match the `version`. The first to commit increments the version.
- The second request will throw a `P2025` (Record not found / version mismatch) error, safely preventing an invalid state transition.

# AUDITABILITY

- **Customer Verification**: A successful verification event is logged (e.g., to server logs or an `AuditLog`), proving the customer authenticated to view the document.
- **Quotation Approval**: When a customer accepts or rejects a quotation via the portal, the mutation must leave an explicit audit trail (e.g., appending a system note or `RepairLog` equivalent) stating: `[PORTAL] Quotation accepted by customer via portal verification`. This ensures non-repudiation and distinguishes customer actions from staff actions.

# PERFORMANCE

- Rely on React Server Components for the public view with static/cached hydration. Client Components are used strictly for the verification form and approval buttons.

# DEFERRED SCOPE

- Online Invoice Payment (Stripe).
- SMS Delivery.
- Magic link one-click logins (we rely on manual Email/Phone input for verification to act as a definitive factor).

# ACCEPTANCE CRITERIA

1. `Quotation` model migrated to include `portalToken` and `version`.
2. `Repair` model migrated to include `portalToken`.
3. Customer navigates to `/portal/[portalToken]` and cannot see any PII without verification.
4. Verification endpoint uses constant-time generic responses and is rate-limited by IP/token.
5. Successful verification issues a 2-hour HTTP-only JWT.
6. Customers can securely Accept/Reject quotations.
7. Concurrency tests prove that simultaneous customer and staff updates do not corrupt state.
8. Audit events are recorded for portal access and decisions.

---

**ARCHITECTURE AMENDED — READY FOR PLANNING**
