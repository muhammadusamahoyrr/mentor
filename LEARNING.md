# Learning Resources — Phase 1 (Weeks 1–3)

**Arbisoft AI-Focused Internship Program 2026 · Web track**
Author: Muhammad Usama
Links last verified: **13 July 2026** — every URL below was fetched and confirmed to resolve on that date.

## How to read this

Each row maps one syllabus topic to the resource I learned it from **and to the file in this
repository where I applied it**. The third column is the point: it lets the work be checked against
the learning, not just asserted alongside it.

Preference throughout is for **primary sources** — the official docs of the tool actually in the
stack — over tutorials and blog posts. Where an official free course exists, it is listed.

The stack this maps onto:

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind |
| Backend | Node.js, Express, microservices |
| Data | Prisma + PostgreSQL (notes-service), Mongoose + MongoDB (appointment-service) |
| Auth | JWT (shared secret across services), role-based authorization |
| Testing | Vitest + React Testing Library (frontend), Jest + Supertest (backend) |
| Tooling | ESLint (flat config), Claude Code |

---

## Week 1 — Frontend Fundamentals

| Topic | Resource | Where I applied it |
|---|---|---|
| Modern JS essentials: `async`/`await`, promises, `fetch` | [MDN — How to use promises](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Promises) | `frontend/lib/auth.ts` — every service call is an `async` function over `fetch` |
| TypeScript essentials | [TypeScript Handbook — Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) | `frontend/types/`, typed props throughout `frontend/components/` |
| React component fundamentals | [react.dev — Learn React](https://react.dev/learn) | All of `frontend/components/` |
| Next.js App Router fundamentals | [Next.js — Getting Started (App Router)](https://nextjs.org/docs/app/getting-started) | `frontend/app/` |
| **Free official course** (built a dashboard app end to end) | [Next.js Foundations — Dashboard App](https://nextjs.org/learn/dashboard-app) | Informed the whole `frontend/app` structure |
| Client-side routing; what a route *is* | [Next.js — Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) | 6 routes: `app/page.tsx`, `(auth)/login`, `(auth)/register`, `(dashboard)/patient`, `(dashboard)/doctor`, `(dashboard)/video/[id]` — the last is a dynamic route |
| Shared layout | [Next.js — Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) | `frontend/app/layout.tsx`, plus route-group layouts under `(auth)` and `(dashboard)` |
| State: local state and **lifting state up** | [react.dev — Sharing State Between Components](https://react.dev/learn/sharing-state-between-components) | `frontend/components/vault/FileVault.tsx` — takes optional `externalFiles` / `onExternalFilesChange` so the doctor page can lift the file list out of the component |
| State: **context** | [react.dev — Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context) | `frontend/contexts/ThemeContext.tsx` |
| Forms, **controlled inputs**, validation | [react.dev — `<input>` reference](https://react.dev/reference/react-dom/components/input) | `frontend/components/analytics/PatientAnalytics.tsx` → `RecordVitalForm`: controlled `value`/`onChange`, plus real validation — at least one measurement required, and blood pressure must have *both* numbers or neither |
| Talking to an HTTP API, error handling | [MDN — Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) | `frontend/lib/auth.ts`, `frontend/lib/notesServiceProxy.ts` |
| Linting — ESLint **flat config** | [ESLint — Getting Started](https://eslint.org/docs/latest/use/getting-started) | `frontend/eslint.config.mjs` (flat config; includes a `no-unused-vars` rule teaching the `_`-means-discarded convention) |
| Formatting — Prettier + ESLint together | [Prettier — Install](https://prettier.io/docs/install) (see `eslint-config-prettier`) | Tooling setup |
| Frontend unit testing — Vitest | [Vitest — Guide](https://vitest.dev/guide/) | `frontend/vitest.config.ts`, `frontend/vitest.setup.ts` |
| React Testing Library | [Testing Library — React intro](https://testing-library.com/docs/react-testing-library/intro/) | `frontend/__tests__/` — `AppointmentForm.test.tsx`, `Logo.test.tsx`, `auth.test.ts` (20 tests) |
| AI coding environment + prompt patterns | [Claude Code — Documentation](https://code.claude.com/docs/en/overview) | `frontend/prompts.md` and `Backend/prompts.md` — running logs of every significant prompt |

---

## Week 2 — Backend, REST, CRUD & ORM

| Topic | Resource | Where I applied it |
|---|---|---|
| HTTP methods; **safe vs idempotent** | [MDN — HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) | Route definitions across `Backend/services/*/src/routes/` |
| HTTP status codes | [MDN — HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status) | `201` create, `400` validation, `401` unauthenticated, `403` wrong role, `404` missing, `409` unique-constraint conflict |
| REST design: resources, nouns, verbs, conventions | [Microsoft Learn — Web API design best practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) | `/api/notes`, `/api/doctors`, `/api/appointments` — plural nouns, verbs carried by the HTTP method |
| Express fundamentals: routing, handlers, **middleware** | [Express — Routing guide](https://expressjs.com/en/guide/routing.html) | `Backend/services/notes-service/src/routes/noteRoutes.js`, `doctorRoutes.js`; `router.use(authenticate)` as middleware |
| CRUD end to end | [Express — Routing guide](https://expressjs.com/en/guide/routing.html) | `Backend/services/notes-service/src/controllers/noteController.js` — create / read / list / update / delete |
| ORM: models, migrations, **relationships** | [Prisma — Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) | `Backend/services/notes-service/prisma/schema.prisma` — `Doctor → Note[]` **one-to-many**, the required relationship |
| ODM alternative: schemas and models in MongoDB | [Mongoose — Schemas guide](https://mongoosejs.com/docs/guide.html) | `Backend/services/appointment-service/src/models/Appointment.js` |
| Input validation & error handling | [Zod — Docs](https://zod.dev/) | `Backend/services/notes-service/src/middleware/errorHandler.js` — a central `AppError` plus Prisma error mapping (`P2002` → conflict, `P2025` → not found) |
| Backend unit/API tests | [Jest — Getting Started](https://jestjs.io/docs/getting-started) | `Backend/services/*/src/__tests__/` |

---

## Week 3 — Auth, Authorization, API Tests & Integration

| Topic | Resource | Where I applied it |
|---|---|---|
| JWT basics: structure, signing, claims | [jwt.io — Introduction to JSON Web Tokens](https://www.jwt.io/introduction) | `Backend/services/notes-service/src/middleware/authMiddleware.js` — verifies the token and normalises `req.user.id` |
| Password hashing — what to actually use | [OWASP — Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | auth-service registration. *(Worth noting: OWASP now recommends **Argon2id** first and treats bcrypt as legacy.)* |
| **Role-based authorization** | [Express — Routing guide](https://expressjs.com/en/guide/routing.html) (middleware) + [jwt.io](https://www.jwt.io/introduction) (claims) | `authorizeRole('doctor')` — guards `POST /api/doctors` and `DELETE /api/notes/:id`. Ownership is checked *on top* of role, so a doctor can only delete their own note |
| CORS, cookies, same-origin | [MDN — Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) | notes-service accepts the JWT as a **bearer token or a cookie**. Cookies are scoped by domain, not port — so after logging in on `:3001`, omitting the `Authorization` header does *not* make you anonymous to `:3006`. The Postman collection empties the cookie jar so the 401 test stays honest |
| Connecting frontend ↔ backend, loading & error states | [Next.js — Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) | `frontend/app/api/**` proxy routes → `frontend/lib/notesServiceProxy.ts` |
| **API tests** with Supertest | [Supertest — GitHub](https://github.com/ladjs/supertest) | `Backend/services/notes-service/src/__tests__/notes.api.test.js` — covers auth (401/403), CRUD, and error paths |
| **Integration test**, happy path end to end | [Supertest — GitHub](https://github.com/ladjs/supertest) | `Backend/services/notes-service/src/__tests__/consultation.integration.test.js` |
| Git discipline: meaningful commits, reviewing AI diffs | [Pro Git — Ch. 5.2, Contributing to a Project](https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project) | Commit history — e.g. `d384f9c` (silent write-failures) and `301423f` (doctor keyspace), each stating *what changed, why, and what was deliberately not fixed* |
| AI-assisted refactoring & code review | [Claude Code — Documentation](https://code.claude.com/docs/en/overview) | See `prompts.md`. A worked example: an AI-generated bug report was audited claim by claim — 4 real bugs were fixed, **1 was a false positive and rejected**, and the "vault cache corruption" turned out to be real but in a different file than reported |

---

## Test coverage as it stands

| Suite | Tests |
|---|---|
| Frontend (Vitest + RTL) | 20 |
| notes-service (Jest + Supertest) | 45 |
| appointment-service | 13 |
| notification-service | 8 |
| auth-service | 4 |
| **Total** | **90** |

Lint: clean pass, 0 warnings (`npx eslint .`). Typecheck: clean (`npx tsc --noEmit`).

---

## A note on how these were used

The assignment asks for a `prompts.md` log, which is kept in two places
(`frontend/prompts.md`, `Backend/prompts.md`). The habit worth recording alongside it: **an AI
suggestion is a claim, not a fact.** The clearest instance in this repo is the Week 3 re-audit,
where a reported "falsy values evaluated as empty" bug in the vitals form was checked against the
actual code and found to be wrong — the inputs are `type="number"`, so `"0"` is a truthy string and
was already handled correctly. Applying that "fix" would have been a no-op at best. It was rejected
with a reason, and the reason is in the commit history.
