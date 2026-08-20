# Loop 02: Application Dashboard and UI Shell

## Objective

Design and implement the authenticated application shell that serves as the foundation for all future Stoney Platform modules.

## Architecture

We are using a **Next.js Route Group** (`src/app/(authenticated)`) to create the boundary for the App Shell.
This allows us to share the authenticated layout component (`layout.tsx`) seamlessly across protected routes without exposing it to public routes like `/login` or polluting the URL.

The architecture enforces:

- **Server Components Priority:** Data fetching (user session, branch, permissions) happens natively on the server before rendering the UI.
- **Strict Authorization:** Navigation visibility is purely UX. PostgreSQL permissions are used to filter the navigation server-side before passing it down. Protected operations continue to rely on the server-side `requireAuth()` guards.

## Components

The Application Shell is composed of:

1. **AppShell (`src/components/layout/AppShell.tsx`):** The primary client component wrapper that manages transient UI states (like the mobile navigation menu).
2. **Sidebar (`src/components/layout/Sidebar.tsx`):** A fixed desktop navigation pane that displays the static navigation links and highlights the active route.
3. **Header (`src/components/layout/Header.tsx`):** A top navigation bar that contains the mobile `Sheet` trigger (hamburger menu) and the User Menu.
4. **UserMenu (`src/components/layout/UserMenu.tsx`):** A dropdown component providing user context, role display, and secure logout capability via the existing Firebase/server session workflow.

## Navigation Strategy

Navigation is statically defined in `src/config/navigation.ts`.
Instead of introducing complex dynamic databases like Firestore, we maintain a static array of modules mapped to their required PostgreSQL permissions (e.g., `dashboard:read`). The server component filters this array down to only the modules the authenticated user is authorized to see.

## UI & Styling

- Built using **Tailwind CSS** and **shadcn/ui** components.
- Fully responsive design: A persistent sidebar on desktop breakpoints (`sm:flex`) and an accessible Radix `Sheet` overlay on mobile.

## Error and Loading States

- Implemented `loading.tsx` to provide immediate feedback during server-side transitions.
- Implemented `error.tsx` (Client Component) to gracefully catch rendering exceptions without leaking sensitive data.
- Implemented `not-found.tsx` for unmatched routes within the authenticated boundary.

## Constraints Respected

- **No new state libraries** (Zustand, Redux, Jotai were explicitly avoided). Standard React `useState` is used for the mobile menu.
- **No duplicated DB sources.** Firestore was not introduced.
- **PostgreSQL remains authoritative.**
- Firebase Auth context remains intact for client login/logout flows but is not utilized for authoritative server-side layout rendering.
