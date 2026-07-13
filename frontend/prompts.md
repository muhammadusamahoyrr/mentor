# prompts.md — Week 1 & Week 3 Prompt Log (Frontend)
**Intern:** Muhammad Usama  
**Program:** Arbisoft AI-Focused Internship 2026  
**Weeks:** 1 — Frontend Fundamentals · 3 — Wiring the frontend to the backend  

This file documents every significant prompt I used while building the CareLoop frontend. **Week 1** built the UI against mock data and `localStorage`; **[Week 3](#week-3--wiring-the-frontend-to-the-backend)** is where it met a real backend. Prompts are logged in the order I used them, along with a short note on what I was trying to do and what I learned from the result.

Week 2 was backend-only — its log, and the backend half of Week 3, live in `Backend/prompts.md`.

---

## Day 1 — Project Setup & Scaffolding

### Prompt 1
> I want to start a new Next.js 16 project using the App Router, TypeScript, and Tailwind CSS v4. I also want to use ESLint and Prettier from the start. Can you give me the exact commands to scaffold it and show me what the folder structure should look like for a multi-page app?

**What I was doing:** First time setting up a Next.js project from scratch. I wanted to make sure I was using the App Router (not the old pages/ directory) since the assignment mentioned modern patterns.

**What I learned:** The `create-next-app` command handles most of it but I had to manually install Tailwind v4 separately because v4 uses a PostCSS plugin instead of the old `tailwind.config.js`. Also learned that the App Router uses `layout.tsx` at the root level as the shell for the whole app.

---

### Prompt 2
> I'm building a healthcare app called CareLoop. It needs two types of users — patients and doctors. I want separate dashboard routes for each role. Can you help me plan out the route structure using Next.js App Router route groups? I want auth pages (login, register) and dashboard pages to be logically separated.

**What I was doing:** Planning the folder structure before writing any code so I don't have to restructure later.

**What I learned:** Route groups like `(auth)` and `(dashboard)` let you organize folders without affecting the actual URL. So `app/(auth)/login/page.tsx` still just maps to `/login`. This was a nice pattern I didn't know about before.

---

### Prompt 3
> I want to set up a shared root layout in Next.js that wraps the entire app with a custom Google font (Plus Jakarta Sans) and a ThemeProvider context. Show me how to do this in `app/layout.tsx` and how to configure the font properly using `next/font/google`.

**What I was doing:** Setting up the global layout with the font I wanted and preparing for dark mode support later.

**What I learned:** You pass the font as a CSS variable and apply it in the body className. The `suppressHydrationWarning` on the `<html>` tag is needed when you have theme toggling to avoid a hydration mismatch.

---

## Day 1–2 — Landing Page

### Prompt 4
> I'm building a landing page for CareLoop, a healthcare appointment management platform. It should have: a sticky navbar with sign in / get started buttons, a hero section with a headline and a feature image, a features bento grid section, a services section, a how it works section, testimonials, a CTA banner, and a footer. Use Framer Motion for scroll-triggered animations and Tailwind for styling. Make it look modern and clean — not like a typical Bootstrap template.

**What I was doing:** Building the full landing page in one go. I gave a lot of context upfront so the output would be closer to what I actually wanted.

**What I learned:** Being specific about the sections I need and the visual direction (modern, not Bootstrap-looking) gave me a much better starting point than just saying "make a landing page". The bento grid layout for features was suggested by the AI and I really liked it.

---

### Prompt 5
> The hero section has a photo from Unsplash and I want three floating info cards on top of it — one showing "System Status: Operational", one showing a recovery percentage, and one showing the next appointment. They should float and gently bob up and down using Framer Motion's animate prop. Can you show me how to do this?

**What I was doing:** Adding visual polish to the hero image with animated overlay cards.

**What I learned:** You can use `animate={{ y: [0, -6, 0] }}` with `repeat: Infinity` to get a continuous float loop. Each card has a different duration and delay so they don't all move in sync.

---

## Day 2 — Authentication Pages

### Prompt 6
> Build me a login page for CareLoop using Next.js App Router. It should be a form with email and password fields, client-side validation, a loading state on the submit button, and an error message display. After login, redirect to `/doctor` or `/patient` based on the user's role. Use Tailwind for styling and keep it clean — no third-party form libraries.

**What I was doing:** Building the login form with controlled inputs and validation.

**What I learned:** For controlled inputs in TypeScript you have to properly type the event handler as `ChangeEvent<HTMLInputElement>`. I also learned that `useRouter` from `next/navigation` (App Router) behaves differently from the old `next/router` — you use `router.push()` for navigation and `router.replace()` so the login page doesn't stay in browser history after redirect.

---

### Prompt 7
> I have a login page but the form doesn't do anything yet. Can you help me build a mock authentication module in `lib/auth.ts` that:
> - stores logged-in user in localStorage under a key called `careloop_user`
> - has a `login()` function that checks credentials against a registered users list in localStorage
> - has a `register()` function that saves new users
> - has a `logout()` function that clears localStorage and redirects to /login
> - returns a user object with id, name, email, role, createdAt, updatedAt
> No real backend yet — this is all client-side for now.

**What I was doing:** Building the auth logic without a real backend since the focus this week is frontend, not API integration.

**What I learned:** `typeof window === 'undefined'` is the check you need before touching localStorage in Next.js because server components run on Node where `window` doesn't exist. Also learned to type things carefully — the registered users in localStorage include passwords but the `User` type doesn't, so I had to destructure to strip it before returning.

---

### Prompt 8
> I want to add a registration page that collects name, email, password, and role (patient or doctor). If the user selects "doctor" I want to show an additional specialization field. Validate that the password is at least 8 characters and the email looks valid before allowing submit. Show inline error messages per field, not just a single top-level error.

**What I was doing:** Building the register form with conditional field rendering and per-field validation.

**What I learned:** Conditional rendering based on a form field value is straightforward in React — just watch the state value and toggle the JSX. For per-field errors I used a `Record<string, string>` state object and set keys per field name.

---

## Day 3 — Type Definitions & Shared State

### Prompt 9
> I need a central TypeScript types file for my CareLoop app. Define these interfaces: User (with id, email, name, role, specialization, createdAt, updatedAt), Appointment (with id, patientId, doctorId, date, time, reason, status as a union type, and optional populated patient/doctor objects), AppNotification, LoginCredentials, RegisterData, AppointmentFormData, AuthResponse, ApiError, and MedicalFile (with categories Prescription / Lab Result / Scan). Put everything in `types/index.ts`.

**What I was doing:** Centralizing all types before building components so I don't write conflicting shapes in different files.

**What I learned:** TypeScript union types like `'pending' | 'confirmed' | 'cancelled' | 'completed'` are great for status fields — they act as enums but are simpler to use. Putting all shared types in one index file makes imports cleaner.

---

### Prompt 10
> Can you help me build a ThemeContext in React that supports light/dark mode? It should persist the selected theme to localStorage and apply a CSS class to the `<html>` element so Tailwind's `dark:` variants work. Wrap the context in a `ThemeProvider` component I can use in my root layout.

**What I was doing:** Setting up theme switching support for the whole app.

**What I learned:** The initial theme read from localStorage needs to happen before the first render to avoid a flash of the wrong theme. You handle this with a small inline script in `<head>` or by reading the value in a `useEffect`. Also, `suppressHydrationWarning` on the html tag is important here.

---

## Day 3–4 — Dashboard Pages

### Prompt 11
> Build me a doctor dashboard page for CareLoop at `app/(dashboard)/doctor/page.tsx`. It should:
> - redirect to /login if no user is found in localStorage
> - show a greeting with the doctor's name
> - show 4 stat cards: total patients, new requests, approved, completed — using Framer Motion for stagger animation
> - show an appointment pipeline with a filter bar (all / pending / confirmed / completed) and a search input
> - have a sidebar with a Schedule View button that opens a calendar modal
> Use mock appointment data for now. Make it look polished and professional.

**What I was doing:** Building the main doctor-facing dashboard with multiple interactive features.

**What I learned:** Framer Motion's `staggerChildren` on a container variant automatically delays each child's animation. I also learned to use `AnimatePresence` with `mode="popLayout"` so that when the filter changes, the old list fades out smoothly before the new one appears.

---

### Prompt 12
> I have a doctor dashboard that loads mock data. Can you now build the patient dashboard at `app/(dashboard)/patient/page.tsx`? The patient should be able to:
> - see their upcoming appointments
> - book a new appointment using a form that lets them pick a doctor, date, time, and reason
> - see analytics about their health history
> - access a file vault to upload and view medical documents
> Keep the visual design consistent with the doctor dashboard.

**What I was doing:** Building the patient-facing version of the dashboard, mirroring the doctor dashboard structure but with different actions.

**What I learned:** Lifting state to the page level and passing handlers down as props is the right approach here because multiple components (AppointmentForm, AppointmentList) need to share the same appointments array.

---

### Prompt 13
> I'm getting a hydration error in Next.js that says the server-rendered HTML doesn't match the client. It happens because I'm reading from localStorage on the initial render. How do I fix this properly without seeing a flash of wrong content?

**What I was doing:** Debugging a common Next.js issue I ran into.

**What I learned:** The solution is to initialize the state to `null` (or a loading state) on the server and only read from localStorage inside a `useEffect`, which only runs on the client. The loading skeleton pattern — showing a skeleton UI while `isLoading` is true — handles the gap cleanly and also improves perceived performance.

---

## Day 4 — Shared Components

### Prompt 14
> Build me a reusable Navbar component for CareLoop. It should show the CareLoop logo, a notification bell icon that shows unread count as a badge, the logged-in user's name, a theme toggle button, and a logout button. It should accept a `user` prop that can be null (for the loading state). Use Tailwind and keep it responsive.

**What I was doing:** Building the shared navigation used by both dashboards.

**What I learned:** Conditional rendering for `user` being null vs. having a value is cleaner when you use early returns or guard clauses at the top of the render, rather than nesting ternaries in the JSX.

---

### Prompt 15
> I need a reusable Skeleton loading component in React. It should accept a `className` prop for sizing and an optional `count` prop to render multiple skeletons in a row. Use a CSS pulse animation. I'll use this as the loading state for dashboards and cards.

**What I was doing:** Building a skeleton loader so the UI doesn't show a blank screen during data fetch.

**What I learned:** Using `Array.from({ length: count })` to render N skeleton items is cleaner than writing them out individually. The `animate-pulse` Tailwind utility handles the shimmer with no extra CSS.

---

### Prompt 16
> Build me an AppointmentForm component. It should let patients:
> - pick a doctor from a dropdown (populated from the mock doctors list)
> - pick a date using a date input (no past dates allowed)
> - pick a time from preset 30-minute slots
> - enter a reason (textarea, at least 10 characters)
> Validate all fields client-side before submitting. Show a success confirmation when submitted. Accept an `onSubmit` callback prop.

**What I was doing:** Building the core form component with validation. This is one of the key Week 1 requirements — a form with client-side validation.

**What I learned:** For the date input `min` attribute, you need to format today's date as `YYYY-MM-DD` using `new Date().toISOString().split('T')[0]`. This prevents selecting past dates natively in the browser. I also learned to validate all fields together on submit, not just on each individual change, to avoid showing errors before the user has had a chance to fill things in.

---

### Prompt 17
> Build me an AppointmentList component that takes an array of appointments and a role ('doctor' or 'patient') and renders each appointment as a card. For doctors, each card should have Confirm and Cancel action buttons. For patients, it should show the appointment status as a colored badge. Handle empty states with a friendly message. Use TypeScript props.

**What I was doing:** Building the list component used by both dashboards.

**What I learned:** Using a `role` prop to conditionally render different actions in the same component is cleaner than having two separate list components. The status badge colors were done using a lookup object `const statusColors = { pending: '...', confirmed: '...' }` which is more readable than a switch statement.

---

## Day 4–5 — File Vault & Analytics

### Prompt 18
> I need a FileVault component for patients to manage their medical documents. It should have:
> - a drag-and-drop dropzone to upload files
> - a list of uploaded files displayed as cards (FileCard)
> - filter buttons by category: Prescription, Lab Result, Scan
> - each card shows file name, size, category, upload date, and a share with doctor toggle
> Use mock data for now. Put the subcomponents in `components/vault/`.

**What I was doing:** Building a multi-component feature with internal state, sub-components, and a dropzone.

**What I learned:** File drag-and-drop in React uses the `onDragOver`, `onDrop`, and `onDragLeave` events. You need to call `e.preventDefault()` in `onDragOver` to prevent the browser from trying to navigate to the file. I structured it as a folder `components/vault/` with separate files for each piece.

---

### Prompt 19
> Build analytics components using Recharts for:
> 1. DoctorAnalytics — a line chart of weekly appointment counts and a pie chart of appointment status distribution
> 2. PatientAnalytics — a bar chart of monthly health check-ins
> Use mock data. Make sure they are responsive (the charts should resize with the container). Put them in `components/analytics/`.

**What I was doing:** Adding data visualization to both dashboards.

**What I learned:** Recharts' `ResponsiveContainer` handles responsive resizing — you just set `width="100%"` and give it a fixed height. I also learned to memoize the chart data with `useMemo` so it doesn't recalculate on every render.

---

### Prompt 20
> I need a CalendarModal component that opens as an overlay when the doctor clicks "Open Calendar". It should show a monthly grid with appointment indicators on days that have bookings. Accept an `appointments` array and an `onClose` prop. Use Framer Motion for the entry/exit animation.

**What I was doing:** Building the calendar overlay for the doctor's schedule view.

**What I learned:** Building a calendar grid from scratch means generating all the days in a month plus padding days from the previous month to fill the first row. The key formula is `new Date(year, month, 1).getDay()` to get the starting weekday. Framer Motion's `AnimatePresence` + `motion.div` with `initial/animate/exit` makes the modal slide in and out smoothly.

---

## Day 5 — API Layer & Proxy Setup

### Prompt 21
> I want to set up an Axios instance for my CareLoop frontend that will eventually connect to a real backend. Create it in `lib/api.ts`. It should read the base URL from an environment variable `NEXT_PUBLIC_API_URL` and fall back to `localhost:3001`. Add the Content-Type header by default.

**What I was doing:** Setting up the HTTP client for future backend integration.

**What I learned:** In Next.js, only environment variables prefixed with `NEXT_PUBLIC_` are available in the browser. Variables without that prefix are server-side only. Since we'll eventually call the API from client components, the prefix is necessary.

---

### Prompt 22
> I have two microservices — one for appointments on port 3002 and one for file management on port 3005. I want to proxy calls to them through Next.js API routes so the client doesn't need to know the service URLs. How do I build server-side proxy utility functions using `NextRequest` and `NextResponse`? They should forward the auth cookie and Authorization header.

**What I was doing:** Setting up the proxy layer for when the real backends are ready. Also learning how the BFF (Backend-for-Frontend) pattern works.

**What I learned:** Next.js API routes run on the server so they can safely forward cookies. The `cookies()` helper from `next/headers` reads the incoming request cookies. I forward both `Cookie` and `Authorization` headers to the downstream service to cover both cookie-based and token-based auth.

---

## Day 5–6 — Linting, Formatting & Tests

### Prompt 23
> My Next.js project has ESLint installed. Can you show me how to configure it properly for a TypeScript + React project using the flat config format (`eslint.config.mjs`)? I want rules for React hooks and TypeScript. Also show me how to set up Prettier with a `.prettierrc` so they don't conflict with each other.

**What I was doing:** Setting up the linting and formatting toolchain as required by the assignment checklist.

**What I learned:** ESLint v9 uses a flat config file (`eslint.config.mjs`) instead of the old `.eslintrc`. Prettier and ESLint can conflict on formatting rules — the fix is to use `eslint-config-prettier` which disables the ESLint rules that Prettier handles. Run `eslint` for code quality and `prettier --write` for formatting, not both for the same thing.

---

### Prompt 24
> Help me write a unit test for my Logo component using Vitest and React Testing Library. The Logo component accepts `withText` and `size` props. I want to test that: (1) it renders without crashing, (2) the text "CareLoop" appears when `withText` is true, (3) the text does not appear when `withText` is false. Show me the full test file including imports and the describe/it structure.

**What I was doing:** Writing my first unit test for a UI component.

**What I learned:** React Testing Library's `render()` returns query utilities like `getByText`, `queryByText`, and `getByRole`. The difference between `getBy` and `queryBy` is that `getBy` throws if the element isn't found, while `queryBy` returns null — so use `queryByText` when you're asserting something is NOT there.

---

### Prompt 25
> Write a test for the `login` function in `lib/auth.ts` using Vitest. Test these cases:
> 1. A user who was previously registered can log in with correct credentials
> 2. Login fails and throws an error when the password is wrong
> 3. `getCurrentUser` returns null when no user is in localStorage
> Mock localStorage using vitest's fake environment (jsdom).

**What I was doing:** Writing unit tests for the auth module — testing pure logic, not UI.

**What I learned:** Vitest uses jsdom as the test environment (configured in `vitest.config.ts`) which gives you a fake `localStorage`. You can set it up with `localStorage.setItem()` in `beforeEach` and clear it in `afterEach`. Testing async functions uses `await expect(fn()).resolves.toEqual(...)` or `await expect(fn()).rejects.toMatchObject(...)`.

---

### Prompt 26
> Write a unit test for my AppointmentForm component. I want to test:
> 1. The form renders with all required fields (doctor select, date, time, reason)
> 2. Submitting with empty fields shows validation error messages
> 3. Filling in all fields correctly and submitting calls the onSubmit callback
> Use React Testing Library's `userEvent` for simulating user interactions.

**What I was doing:** Writing the third test file to meet the "3+ unit tests" requirement. This one tests a more complex component with form interactions.

**What I learned:** `userEvent` from `@testing-library/user-event` is preferred over `fireEvent` because it simulates real browser interactions (triggers blur, focus, change events in order). You have to call `userEvent.setup()` before each test. Also, for async user interactions you need to `await` each step.

---

## Day 6 — Polish & Refinement

### Prompt 27
> My CareLoop app uses a lot of custom Tailwind class names like `bg-surface`, `text-ink`, `text-dim`, `bg-card`, `border-wire`, `text-ghost`, and `bg-panel`. These are theme-aware tokens. Can you show me how to define these as CSS custom properties in `globals.css` so they work for both light and dark mode, and how to register them as Tailwind utilities?

**What I was doing:** Making the design system's semantic color tokens work with Tailwind v4 and theme switching.

**What I learned:** In Tailwind v4 you can define custom utilities directly in CSS using `@layer utilities`. Pairing this with CSS variables and a `.dark` class on `<html>` makes theme switching work without any JavaScript — just toggling the class.

---

### Prompt 28
> I have a NotificationBell component that should fetch notifications from an API and show a badge count. For now I want it to use mock data. It should open a dropdown panel when clicked showing the latest notifications, each with a title, message, and read/unread state. Clicking a notification marks it as read. How should I structure this so it's easy to swap the mock data for a real API call later?

**What I was doing:** Building the notification bell while keeping the data layer swappable.

**What I learned:** The cleanest way to make a mock swappable with a real API is to put the data-fetching logic in a separate function (or hook) and have the component only depend on the returned data shape. Then replacing mock data with a real `axios.get()` call later only requires changing that one function.

---

### Prompt 29
> My Next.js app is deployed on `localhost:3000`. I'm getting a CORS error when trying to call `localhost:3001` from the browser. What's the correct way to handle this in development using Next.js rewrites in `next.config.ts`? I don't want to change the backend.

**What I was doing:** Debugging a CORS issue during local development.

**What I learned:** Next.js `rewrites` in `next.config.ts` act as a reverse proxy — the browser only ever talks to `:3000` and Next.js forwards the request to the real backend. This bypasses CORS entirely in development. For production you'd set up a proper proxy in your cloud gateway.

---

### Prompt 30
> Can you do a final review of my AppointmentForm component and tell me if there are any TypeScript type errors, missing accessibility attributes (aria labels, input IDs), or validation edge cases I might have missed? I want to make sure it's clean before I submit.

**What I was doing:** Final review pass before wrapping up the week.

**What I learned:** Always add `htmlFor` on `<label>` and matching `id` on the `<input>` — React Testing Library's `getByLabelText` query relies on this and it's also critical for screen readers. I was also missing an explicit `aria-required` attribute on required fields, even though the `required` HTML attribute was there.

---

## Summary — Week 1

| # | Prompt Category | Key Concept Covered |
|---|---|---|
| 1–3 | Project Setup | App Router, fonts, layouts, route groups |
| 4–5 | Landing Page | Framer Motion, bento grid, scroll animations |
| 6–8 | Auth Pages | Controlled forms, localStorage auth, TypeScript events |
| 9–10 | Types & Context | TypeScript interfaces, ThemeContext, CSS variables |
| 11–13 | Dashboards | Role-based routing, hydration fix, stagger animations |
| 14–17 | Shared Components | Navbar, Skeleton, AppointmentForm, AppointmentList |
| 18–20 | Vault & Analytics | Drag-and-drop, Recharts, CalendarModal |
| 21–22 | API Layer | Axios instance, Next.js proxy, BFF pattern |
| 23 | Linting & Formatting | ESLint flat config, Prettier, conflict resolution |
| 24–26 | Unit Tests | Vitest, React Testing Library, userEvent, async tests |
| 27–30 | Polish | Tailwind tokens, notifications, CORS, accessibility |

**Total significant prompts logged: 30**

---
---

# Week 3 — Wiring the Frontend to the Backend

**Week:** 3 — Auth, Authorization, API Tests & Integration (the frontend half)

Week 1 built the UI against `localStorage` and mock data. Week 3 is where it meets a real backend —
and where I found out how much of the "working" app was only pretending to work. The backend log
lives in `Backend/prompts.md`; this file covers what changed on the client.

---

## Day 1 — Finding out what was actually connected

### Prompt 31
> As a senior full stack developer, list the remaining wiring between the frontend and the backend
> services. Check deeply whether each service is connected to the frontend or not.

**What I was doing:** Auditing before building, instead of assuming my own code worked.

**What I learned:** A BFF proxy existing is **not** the same as a feature being wired.
`lib/notesServiceProxy.ts` and `app/api/notes/[[...path]]/route.ts` both existed and were correct —
and **not one line of frontend code ever called `/api/notes`**. The video page was saving its notes to
a *different* service entirely.

The audit also caught how much of the app was quietly running on mocks. `lib/auth.ts` catches almost
any backend failure and silently falls back to `localStorage`, so **a completely dead backend still
looks like a working app.** That is a nice demo and a terrible way to develop: you cannot tell a
wired feature from an unwired one by clicking around. The only reliable check is to grep for the
caller.

---

## Day 2 — Real CRUD from the UI

### Prompt 32
> Wire the video page notes to notes-service.

**What I was doing:** The Week 3 requirement — full Create / Read / Update / Delete from the frontend,
against a real authenticated API.

**What I learned:** The client change looks small (`fetch('/api/notes')` instead of
`/api/appointments/:id/notes`) but the interesting part is what the **BFF proxy** is for. The browser
only ever talks to same-origin `/api/*` routes; the Next server attaches the httpOnly cookie and
forwards to the service. That means:

- the browser never learns where the services actually live, and
- **the frontend never handles the JWT itself.** It cannot: the cookie is `httpOnly`, so JavaScript
  cannot read it. That is the point.

That last fact is what made me delete `NEXT_PUBLIC_JWT_SECRET` from `.env.local`. Any
`NEXT_PUBLIC_*` variable is inlined into the client bundle the moment one line of code references it —
so a *signing secret* under that prefix is a loaded gun. The frontend signs and verifies nothing, so
it has no business holding one.

### Prompt 33
> Fix the duplicate notes on save.

**What I was doing:** Every visit to the consultation room added another copy of the same note.

**What I learned:** The page loaded your last note into the textarea, but Save always issued a
`POST` — so opening the room and clicking Save duplicated it. The fix is to track **which** note the
editor is holding (`editingNoteId`) and `PUT` when it already exists.

Digging into it turned up a **second bug hiding behind the first**: the editor was pre-filled from
`notes[0]` — the newest note by *anyone*. A patient opening the room would find the **doctor's** note
sitting in their editor. The lesson: when a component's state comes from a list, "the first item" is
almost never the same question as "the item that belongs to me".

The delete button is only rendered for doctors, mirroring the API's role rule — but the API refuses a
patient regardless. **The UI is a convenience, not a security boundary.** Hiding a button is not
authorization.

---

## Day 3 — Making the data real

### Prompt 34
> Fix the analytics mock data and the file upload.

**What I was doing:** Removing the last of the fake data from the dashboards and the vault.

**What I learned, on the analytics:** most of the charts were **already real** — weekly volume,
status distribution and monthly counts all derive from genuine appointments. Two things were not:

- **Revenue** was `revenue += 150`, a hardcoded guess at a consultation fee that exists nowhere in
  the system. A fabricated *money* figure is the most misleading thing you can put on a dashboard —
  it looks authoritative and it is fiction. Deleted, rather than inventing a fee field to justify it.
- **Vitals** (heart rate, BP, weight) came from a hardcoded array. **No service had ever stored a
  vital sign.** So the patient dashboard was charting invented health data *at a patient, as their
  own*. That one got built for real — a `Vital` resource in notes-service, a new
  `/api/vitals` BFF route, and a "Record" form on the dashboard.

Both charts also fell back to a mock array whenever there was no real data — showing a doctor with
zero bookings a chart of somebody's fictional ones. The replacement is an **honest empty state**:
"No readings yet — record one". I would rather show nothing than something untrue, and I now think
*"the chart looks empty"* is one of the most dangerous reasons to write code.

Two React details worth keeping:

- A **trend delta needs two data points.** With a single reading there is nothing to compare against,
  so the component shows no delta rather than inventing one.
- A weight-only reading must plot **nothing** for heart rate — not `0`. Charting a zero would draw a
  patient whose heart had stopped.

### Prompt 35
> (same prompt — the file-upload half)

**What I learned:** the vault **was not uploading files at all.** `FileVault` sent JSON containing a
`fileUrl` it had *invented* (`/mock-vault/1699…-scan.pdf`); the `File` object never left the page.
And `FileCard`'s "Download" generated a **text file summarising the record's metadata**, named
`<name>_decrypted.txt` — it looked like a download and contained none of the document.

It now sends the real `File` as `multipart/form-data`. Two things I would have got wrong:

1. **Do not set `Content-Type` by hand on a `FormData` upload.** The browser has to generate it so it
   can append the multipart boundary; setting it manually produces a body the server cannot parse.
2. **The BFF proxy would have silently destroyed every file.** It did `await request.text()` on the
   way up and `await response.text()` on the way down — **decoding binary as UTF-8**. Every byte
   sequence that isn't valid UTF-8 is replaced with `U+FFFD`, so every PDF and JPEG would have
   arrived quietly corrupted. It only ever "worked" because no real bytes were being sent. Reading and
   writing `arrayBuffer()` in both directions fixes it.

I also **removed the mock fallback** from the upload handler. It used to catch a failure and store a
fake local record showing the upload had succeeded. Telling a patient their scan is safely in the
vault when nothing was stored is far worse than an error message.

---

## Day 4 — The tests were lying

### Prompt 36
> Check again if you missed any task or any issue or error in the repo.

**What I was doing:** A second pass over work already declared finished.

**What I learned:** my Week 1 "unit tests" in `__tests__/auth.test.ts` **were not unit tests.** They
called `register`, `login` and `getCurrentUser`, which make **real network requests**, and they
passed only because nothing happened to be listening on the dev port — so the calls failed fast and
the code fell through to its `localStorage` mock path.

The day a connection to a dead port started *hanging* instead of being refused, all nine timed out.
The tests had never actually asserted "the backend is unreachable"; they had **assumed** it, and got
away with it by luck.

Stubbing the HTTP layer (`vi.mock('../lib/api')` plus a stubbed `fetch`) makes the offline condition
an **explicit precondition** instead of an accident of the machine. They now pass deterministically —
and three times faster, because nothing waits on a socket.

The general lesson, and the one I would keep from the whole week: **a passing test proves nothing
until you know why it passes.** Mine were green for a reason that had nothing to do with my code.

---

## Summary — Week 3 (frontend)

| # | Prompt Category | Key Concept Covered |
|---|---|---|
| 31 | Integration audit | A proxy existing ≠ a feature wired; mock fallbacks hide a dead backend |
| 32 | **Full CRUD + auth** | BFF pattern, httpOnly cookies, why the client must never hold a signing secret |
| 33 | State bugs | "First in the list" ≠ "mine"; hiding a button is not authorization |
| 34 | **Honest data** | Empty state beats invented data; a delta needs two points; `null` ≠ `0` |
| 35 | **Real file uploads** | `FormData` boundaries, binary-safe proxying, never fake a success |
| 36 | Test quality | A passing test proves nothing until you know *why* it passes |

**Total significant prompts logged: 36** (30 in Week 1, 6 in Week 3)

**Week 3 frontend deliverable:** the app is wired to the real backend through the Next.js BFF — login
with an httpOnly JWT cookie, full CRUD on clinical notes from the consultation room (with a
role-gated delete), a medical vault that uploads and downloads **real bytes**, and dashboards that
chart only data the system actually holds, with honest empty states where it holds none. No
`NEXT_PUBLIC_*` secret, no invented revenue, no `/mock-vault/` paths. 20 frontend tests, ESLint and
`tsc --noEmit` clean.
