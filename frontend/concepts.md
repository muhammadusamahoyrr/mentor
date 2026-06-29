# concepts.md — Week 1: Concepts & Implementation Overview
**Intern:** Muhammad Usama  
**Program:** Arbisoft AI-Focused Internship 2026  
**Project:** CareLoop — Healthcare Appointment Management Platform  

This document explains every core concept covered in Week 1 and exactly where and how it is implemented in the CareLoop codebase. The second half covers extra features built beyond the assignment requirements.

---

## Part 1 — Core Week 1 Concepts

---

### 1. HTML, CSS & Modern TypeScript Essentials

**What the concept is:**  
The foundation of the web. HTML structures the page, CSS styles it, and modern JavaScript/TypeScript adds logic and interactivity. Key TS/JS features for frontend work include ES modules (`import`/`export`), `async/await` for asynchronous operations, and the `fetch` API or Axios for talking to HTTP endpoints.

**How it's used in CareLoop:**

- **TypeScript throughout** — every `.tsx` and `.ts` file uses strict TypeScript. Interfaces for all data shapes are centralized in `types/index.ts`. For example, the `Appointment` interface defines `status` as a union type `'pending' | 'confirmed' | 'cancelled' | 'completed'`, which means the compiler will catch any typo before runtime.

- **ES Modules** — every file uses `import`/`export`. There are no `require()` calls. For example, `lib/auth.ts` exports named functions (`login`, `register`, `logout`, `getCurrentUser`) which are imported exactly where needed.

- **async/await** — all auth functions (`login`, `register`, `getCurrentUser`) are `async` and return Promises. The simulated network delay (`await new Promise(r => setTimeout(r, 400))`) mimics a real API round-trip and forces the UI to handle loading states properly.

- **CSS custom properties + Tailwind v4** — instead of hardcoded hex colors scattered everywhere, all theme colors are defined as CSS variables in `globals.css` inside a `@theme {}` block. Tailwind v4 reads these and generates utility classes like `bg-surface`, `text-ink`, `border-wire` automatically. This is a much cleaner system than the old `tailwind.config.js` approach.

---

### 2. Component-Based Architecture (React + Next.js)

**What the concept is:**  
A component is a self-contained, reusable piece of UI. React is built around this idea — you compose small components together to build large interfaces. Each component manages its own rendering logic and receives data through `props`.

**How it's used in CareLoop:**

The component tree is organized into clear responsibilities:

```
app/layout.tsx              ← root shell (font, ThemeProvider)
  app/page.tsx              ← landing page
  app/(auth)/login          ← login form
  app/(auth)/register       ← register form
  app/(dashboard)/doctor    ← doctor dashboard (composes several components)
  app/(dashboard)/patient   ← patient dashboard (composes several components)
```

Shared reusable components live in `components/`:

| Component | Responsibility |
|---|---|
| `Navbar` | Top navigation — accepts a `user` prop, renders differently for doctor vs patient |
| `Logo` | Brand logo — accepts `withText`, `size`, `className` props |
| `Skeleton` | Loading placeholder — accepts `className` and `count` props |
| `AppointmentForm` | Controlled form for booking — accepts `doctors`, `formData`, `setFormData`, `onSubmit`, `loading` props |
| `AppointmentList` | Renders appointment cards — accepts `appointments`, `role`, `onAction` props |
| `NotificationBell` | Notification dropdown — self-contained with its own state |
| `CalendarModal` | Monthly calendar overlay — accepts `appointments` and `onClose` |
| `vault/FileVault` | Full file management feature — internally composes `FileDropzone`, `FileCard`, `FileFilters` |
| `analytics/DoctorAnalytics` | Recharts charts for the doctor view |
| `analytics/PatientAnalytics` | Recharts charts for the patient view |

**Key pattern:** The `AppointmentList` component uses a `role` prop to render different actions for doctors vs patients without duplicating the whole component. This is called **prop-driven conditional rendering**.

---

### 3. Client-Side Routing

**What the concept is:**  
In a traditional website, every URL change loads a new HTML file from the server. In a Single Page Application (SPA), the JavaScript router intercepts navigation events and swaps out page components without a full reload. Next.js App Router handles this through a file-based routing system.

**How it's used in CareLoop:**

Routes are defined purely by folder structure inside `app/`:

```
app/
  page.tsx                  → /
  (auth)/
    login/page.tsx          → /login
    register/page.tsx       → /register
  (dashboard)/
    doctor/page.tsx         → /doctor
    patient/page.tsx        → /patient
    video/[id]/page.tsx     → /video/:id  ← dynamic route
```

**Route Groups** — `(auth)` and `(dashboard)` are route group folders. The parentheses tell Next.js not to include them in the URL path. They exist purely for code organization, not routing.

**Dynamic Route** — `video/[id]/page.tsx` uses a bracket parameter. The `id` segment can be any value (e.g. `/video/appt-3`) and is available to the component through the `params` prop.

**Programmatic Navigation** — `useRouter` from `next/navigation` is used for redirect logic. After login, `router.push('/doctor')` or `router.push('/patient')` navigates based on role. The login page uses `router.replace('/patient')` (not `push`) so the login route is removed from browser history and the back button doesn't bring users back to it.

**Auth Guard** — Both dashboards check for a current user inside `useEffect`. If none is found, they immediately call `router.push('/login')`. This is a client-side route guard.

---

### 4. State Management — Local State, Lifting State, Context

**What the concept is:**  
State is data that changes over time and causes the UI to re-render. React gives three tools for this at different scales:
- **Local state** (`useState`) — data only one component needs
- **Lifting state** — moving state up to a common parent when multiple components need it
- **Context** — sharing state across the entire component tree without passing props at every level

**How it's used in CareLoop:**

**Local state** — Used everywhere for UI-specific state. For example, in the doctor dashboard: `filter` (which status tab is active), `searchQuery` (the search input value), `calendarOpen` (whether the modal is visible), `isLoading` (skeleton display), and `appointments` (the list being worked with) are all separate `useState` calls.

**Lifting state** — In the patient dashboard, `appointments` and `formData` are held at the page level (the parent) and passed down to both `AppointmentForm` and `AppointmentList`. The form updates `formData` through a `setFormData` callback prop. When a new appointment is submitted, the page's `appointments` state is updated. Both child components stay in sync because they share the same source of truth.

```
PatientDashboard (holds: appointments, formData)
   ├── AppointmentForm  (reads formData, calls setFormData + onSubmit)
   └── AppointmentList  (reads appointments)
```

**Context** — `ThemeContext` in `contexts/ThemeContext.tsx` is a perfect example. The `isDark` state and `toggleTheme` function need to be accessible from any component (Navbar toggle button, CSS class on `<html>`, individual cards). Instead of drilling these as props 5 levels deep, they are provided through a context at the root layout level and consumed anywhere with `useTheme()`.

---

### 5. Forms, Validation & Controlled Inputs

**What the concept is:**  
A **controlled input** is an input whose value is driven by React state — not the browser's internal DOM state. Every keystroke updates state, and the state value is what the input displays. This gives full control over the input's value at all times, making validation straightforward.

**How it's used in CareLoop:**

Both auth forms (`login/page.tsx`, `register/page.tsx`) and `AppointmentForm` use controlled inputs.

**Login form pattern:**
```tsx
const [formData, setFormData] = useState<LoginCredentials>({ email: '', password: '' });

const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
  setFormData({ ...formData, [e.target.name]: e.target.value });
};

<input name="email" value={formData.email} onChange={handleChange} />
```

The `e.target.name` trick with spread (`...formData`) means one handler function works for all fields.

**Validation in AppointmentForm:**
- Doctor dropdown: required, must select a value
- Date input: uses `min={new Date().toISOString().split('T')[0]}` to block past dates at the browser level
- Time: selected from predefined 30-minute slots (no free text input, so invalid values are impossible)
- Reason textarea: must be at least 10 characters

**Error state** is managed as a `string` for single-error forms and a `Record<string, string>` object for per-field errors in the register form, keyed by field name.

**Loading state on submit** — the submit button is disabled and shows a spinner while `loading` is `true`, preventing double submissions.

---

### 6. Talking to an HTTP API (Axios + Proxy Pattern)

**What the concept is:**  
Real-world apps need to send and receive data from a backend server over HTTP. `fetch` is the native browser API for this; Axios is a popular library that wraps it with cleaner syntax, automatic JSON parsing, and interceptors.

**How it's used in CareLoop:**

**Axios instance** (`lib/api.ts`):
```ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});
```

A single configured instance is created and exported. Any service file imports `api` and calls `api.get(...)`, `api.post(...)`, etc. The base URL comes from an environment variable so it works in development, staging, and production without code changes.

**Mock-first approach** — Since the real backend is not yet connected, `lib/auth.ts` currently uses localStorage instead of real API calls. The function signatures match what a real API integration would look like (`async`, returns a typed `Promise<AuthResponse>`), so swapping the mock for real Axios calls later requires changing only the function body.

**Next.js Proxy/BFF Pattern** (`lib/appointmentServiceProxy.ts`, `lib/fileServiceProxy.ts`):  
Two backend microservices are planned — one for appointments (`localhost:3002`) and one for files (`localhost:3005`). Rather than calling these directly from the browser (which causes CORS issues and exposes internal URLs), Next.js API routes act as a proxy. The browser talks only to `localhost:3000`, and Next.js forwards the request with the auth cookie and Authorization header attached. This is called the **Backend-for-Frontend (BFF)** pattern.

---

### 7. Linting & Formatting — ESLint + Prettier

**What the concept is:**  
A **linter** (ESLint) analyzes code for bugs, anti-patterns, and rule violations without running it. A **formatter** (Prettier) enforces consistent code style (spacing, quotes, semicolons) automatically. Together they keep a codebase consistent across contributors.

**How it's used in CareLoop:**

- `eslint.config.mjs` — uses the ESLint v9 flat config format. Includes the `next/core-web-vitals` preset which covers React hooks rules, accessibility, and Next.js-specific patterns.
- Prettier is configured with a `.prettierrc` file. Eslint's formatting rules are disabled via `eslint-config-prettier` so the two tools don't conflict — ESLint handles code quality, Prettier handles style.
- `"lint": "eslint"` and `"format": "prettier --write ."` scripts are in `package.json`. Running `npm run lint` catches issues; `npm run format` auto-fixes formatting across all files.

---

### 8. Frontend Unit Testing — Vitest + React Testing Library

**What the concept is:**  
Unit tests verify that individual functions or components behave correctly in isolation. React Testing Library (RTL) encourages testing components the way a user would interact with them — by querying the DOM for visible elements and triggering events — rather than testing implementation details.

**How it's used in CareLoop:**

Three test files cover three different testing scenarios:

**`__tests__/Logo.test.tsx` — Component rendering and prop-driven output:**
Tests that the Logo renders an SVG, that `withText` controls whether "CareLoop" text appears, that `size="sm"` hides the subtitle, and that a custom `className` is applied. Uses `screen.getByText()`, `queryByText()` (returns null instead of throwing when not found), and `container.querySelector()`.

**`__tests__/auth.test.ts` — Pure function logic with localStorage:**
Tests `register`, `login`, and `getCurrentUser` using jsdom's fake `localStorage`. Uses `beforeEach(() => localStorage.clear())` to reset state between tests. Tests the full register → logout → login flow, and verifies that `getCurrentUser` returns null when nothing is stored.

**`__tests__/AppointmentForm.test.tsx` — Interactive component with mocked callbacks:**
Tests that the form renders all fields, that mock doctors appear in the dropdown, that the submit button is disabled when `loading={true}`, that `setFormData` is called when the textarea changes (`fireEvent.change`), and that `onSubmit` is called on form submission. Uses `vi.fn()` to create mock functions and `expect(mock).toHaveBeenCalledWith(...)` to assert they were called correctly.

**Vitest config** (`vitest.config.ts`) uses `jsdom` as the test environment, which provides fake browser APIs (localStorage, document, window) so component tests run in Node without a real browser.

---

## Part 2 — Extra Things Implemented Beyond the Checklist

---

### Extra 1: Design Token System (Semantic CSS Variables)

**What it is:**  
Instead of using raw color values like `#0f172a` in Tailwind classes, all colors are defined once as named tokens in `globals.css` (`--color-surface`, `--color-ink`, `--color-wire`, etc.) inside a `@theme {}` block. Tailwind v4 auto-generates utilities from these variables.

**Why it matters:**  
When switching from light to dark mode, only the variable values change (in the `.dark {}` block) — every component that uses `bg-surface` or `text-ink` automatically gets the correct dark value with zero changes to the component code itself. This is how production design systems work (e.g. Radix, shadcn/ui).

**Where:** `app/globals.css`, lines 13–70.

---

### Extra 2: Dark/Light Theme with System Preference Detection

**What it is:**  
`ThemeContext` (`contexts/ThemeContext.tsx`) implements a full theme system that:
1. On first load, checks `localStorage` for a saved preference
2. Falls back to the OS preference using `window.matchMedia('(prefers-color-scheme: dark)')`
3. Toggles a `dark` class on `<html>` which activates all `.dark {}` CSS overrides
4. Persists the choice to `localStorage`
5. The `.tt` CSS class in `globals.css` adds a smooth 250ms transition to any element when the theme switches

**Why it matters:**  
Most assignment projects ignore dark mode entirely. Implementing it properly — with system preference detection and localStorage persistence — is a production-grade detail.

---

### Extra 3: Framer Motion Animations

**What it is:**  
The landing page and both dashboards use Framer Motion extensively:

- **Scroll-triggered fade-ups** on all sections of the landing page using `whileInView` with `{ once: true }` so animations only fire once as sections enter the viewport
- **Stagger children** on the stat cards grid — the container has `staggerChildren: 0.1` so cards animate in sequence
- **Float loops** on the hero image overlay cards — `animate={{ y: [0, -6, 0] }}` with `repeat: Infinity` gives them a continuous bobbing effect
- **AnimatePresence** with `mode="popLayout"` in the appointment pipeline so filtered lists transition smoothly
- **Spring physics** on stat cards — `type: 'spring', stiffness: 100` makes them feel physically responsive

**Why it matters:**  
JavaScript animations was not in the Week 1 syllabus at all. Adding production-quality motion makes the UI feel alive and demonstrates understanding of animation concepts beyond CSS transitions.

---

### Extra 4: Glassmorphism UI

**What it is:**  
The navbar and floating hero cards use `backdrop-filter: blur()` with a semi-transparent background — a design technique called glassmorphism. It is defined as a reusable `.glass` utility class in `globals.css` with a separate override for `.dark .glass`.

**Where:** `app/globals.css` lines 99–113, `app/page.tsx` navbar and hero cards.

---

### Extra 5: Data Visualization with Recharts

**What it is:**  
Both dashboards include analytics panels built with Recharts:

- **DoctorAnalytics** (`components/analytics/DoctorAnalytics.tsx`) — a stacked line chart of weekly appointment counts (confirmed/pending/completed per day) and a pie chart of the overall status distribution with custom labels
- **PatientAnalytics** (`components/analytics/PatientAnalytics.tsx`) — a multi-line chart tracking patient vitals over time (heart rate, blood pressure systolic/diastolic) and a bar chart of appointment history

All charts use `ResponsiveContainer` (width=100%, fixed height) so they resize correctly on any screen size. Chart data comes from `lib/mockData.ts` which exports named constants (`MOCK_WEEKLY_APPOINTMENTS`, `MOCK_VITALS_TREND`, etc.).

**Why it matters:**  
Data visualization was not part of Week 1 requirements. Implementing it shows understanding of third-party component integration and real healthcare use cases.

---

### Extra 6: File Vault with Drag-and-Drop Upload

**What it is:**  
The `components/vault/` folder contains a full medical file management feature:

- `FileDropzone` — handles `onDragOver`, `onDrop`, and `onDragLeave` browser events. `e.preventDefault()` in `onDragOver` is required to allow the drop. Accepts files and adds them to the vault state.
- `FileCard` — renders individual files with name, size, category badge, upload date, and a "Share with Doctor" toggle
- `FileFilters` — filter buttons for Prescription / Lab Result / Scan categories
- `FileVault` — the parent component that holds state and composes the above

Both dashboards include the FileVault — doctors see all files shared by their patients; patients see and manage their own files.

**Why it matters:**  
Drag-and-drop, file state management, and category filtering are all advanced UI patterns not covered in Week 1. This is a realistic healthcare feature.

---

### Extra 7: Calendar Modal

**What it is:**  
`CalendarModal` (`components/CalendarModal.tsx`) is a full monthly calendar overlay that:
- Generates the correct day grid for any month using `new Date(year, month, 1).getDay()` to find the starting weekday
- Marks days that have appointments with colored indicators
- Supports month navigation (previous/next)
- Animates in/out using Framer Motion's `AnimatePresence`
- Traps focus and closes on outside click or Escape key

**Why it matters:**  
Building a calendar component from scratch (without a library) demonstrates solid understanding of the `Date` API, array manipulation for grid generation, and state management for navigation.

---

### Extra 8: Notification System

**What it is:**  
`NotificationBell` (`components/NotificationBell.tsx`) shows a badge count of unread notifications and opens a dropdown panel when clicked. Features:
- Unread count badge on the bell icon
- Dropdown list of notifications with type icons (appointment vs file_shared)
- "Mark as read" on click, which decrements the badge count
- "Mark all as read" button
- Closes when clicking outside the panel (using a `useEffect` with a `mousedown` event listener)

Data comes from `MOCK_NOTIFICATIONS` in `lib/mockData.ts` and follows the `AppNotification` interface in `types/index.ts`, making it easy to replace with a real API call.

---

### Extra 9: Microservice-Ready Architecture (BFF Proxy Pattern)

**What it is:**  
Two proxy utility files exist for when real backends are connected:
- `lib/appointmentServiceProxy.ts` — proxies to an appointment microservice at `localhost:3002`
- `lib/fileServiceProxy.ts` — proxies to a file microservice at `localhost:3005`

Both forward the auth token (from the `token` cookie) as both a `Cookie` header and an `Authorization: Bearer` header, and correctly pass request bodies for non-GET methods.

**Why it matters:**  
This demonstrates understanding of microservice architecture and the BFF pattern. The frontend doesn't need to know which backend service owns which data — it always talks to Next.js, which routes internally. This also solves CORS completely by keeping all browser traffic on a single origin.

---

### Extra 10: Skeleton Loading States

**What it is:**  
The `Skeleton` component (`components/Skeleton.tsx`) renders animated shimmer placeholder blocks during loading. A custom `@keyframes shimmer` animation in `globals.css` moves a gradient left-to-right over the skeleton element. The dark mode version uses a matching navy shimmer.

Both dashboards show skeleton layouts (matching the real content dimensions) while `isLoading` is true, then swap to real content once the user is confirmed. This avoids jarring blank-screen flashes.

**Why it matters:**  
Skeleton screens are a UX best practice that most student projects ignore. The animation is also implemented in pure CSS, not as a third-party dependency.

---

## Summary Table

| Category | Required | What's Built |
|---|---|---|
| Framework setup | ✅ Next.js App Router + TypeScript | Next.js 16, strict TS, Tailwind v4 |
| 3+ routes with shared layout | ✅ | 6 routes: `/`, `/login`, `/register`, `/doctor`, `/patient`, `/video/[id]` |
| Form with client-side validation | ✅ | Login, Register, AppointmentForm — all controlled inputs, per-field errors |
| ESLint + Prettier | ✅ | Flat config ESLint v9, Prettier with conflict resolution |
| 3+ unit tests | ✅ | 14 test cases across 3 files (Logo, auth, AppointmentForm) |
| State management | ✅ | useState, lifted state, ThemeContext |
| HTTP API pattern | ✅ | Axios instance, mock auth, BFF proxy utilities |
| Prompts log | ✅ | `prompts.md` — 30 prompts logged |
| Dark/light theme | ⬆️ Extra | Full ThemeContext with OS preference detection |
| Framer Motion animations | ⬆️ Extra | Scroll triggers, stagger, spring, float loops, AnimatePresence |
| Recharts data visualization | ⬆️ Extra | Doctor + Patient analytics dashboards |
| Drag-and-drop file vault | ⬆️ Extra | Full FileVault with categories and share toggle |
| Calendar modal | ⬆️ Extra | Built from scratch, no library |
| Notification system | ⬆️ Extra | Bell with badge, dropdown, mark-as-read |
| Glassmorphism UI | ⬆️ Extra | `.glass` utility, sticky navbar, hero cards |
| Semantic design tokens | ⬆️ Extra | CSS custom property token system for all colors |
| Skeleton loading states | ⬆️ Extra | Custom shimmer animation, used in both dashboards |
| Microservice BFF proxies | ⬆️ Extra | Appointment and file service proxy utilities |
