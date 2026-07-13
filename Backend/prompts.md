# prompts.md — Week 2 & Week 3 Prompt Log
**Intern:** Muhammad Usama
**Program:** Arbisoft AI-Focused Internship 2026
**Weeks:** 2 — Backend, REST, CRUD & ORM · 3 — Auth, Authorization, API Tests & Integration

> Week 2 is logged first, then [Week 3](#week-3--auth-authorization-api-tests--integration).

This file documents the significant prompts I used while building the **notes-service** during
Week 2, in the order I used them, with a short note on what I was trying to do and what I
learned. Before the prompts, I've written down the plan I made at the start so it's clear how I
approached the assignment.

---

## The Plan (before I started)

The deliverable is a **CRUD REST API for one resource, modelled with an ORM, with at least one
relationship, input validation, correct status codes, a clean linter pass, and AI-generated unit
tests.**

My plan for the service:

1. **Pick one resource and one relationship.** I chose **Notes**, with a **Doctor → Notes**
   one-to-many relationship (the assignment's "User → Notes" example, adapted to my medical
   domain).
2. **Use a real SQL ORM so migrations and relationships are demonstrable.** The assignment names
   Prisma / SQLAlchemy / Django ORM. Since my code is JavaScript, **Prisma** is the natural fit,
   and I'll use **SQLite** so there's zero database setup.
3. **Build it in layers** — routes → validation middleware → controllers → ORM → database — so
   each concern is separated.
4. **Validate inputs with Zod** and return correct HTTP status codes.
5. **Add a linter (ESLint) and unit tests (Jest)** and get a clean pass on both.
6. **Prove it works end-to-end** and document it so I actually understand each piece.

Stack: **Express + Prisma + SQLite + Zod + Jest + ESLint**, as a standalone service
(`notes-service`). No auth or frontend wiring — that's Week 3.

---

## Day 1 — Choosing the stack

### Prompt 1
> I need to build a CRUD REST API for one resource with an ORM that supports real migrations and
> a relationship. The assignment lists Django ORM, SQLAlchemy, or Prisma. My backend is
> JavaScript — which is easiest to use, and what database should I pick for a simple demo?

**What I was doing:** Choosing the ORM and database before writing any code.

**What I learned:** Django ORM and SQLAlchemy are Python — using either would mean adding a whole
new language. **Prisma is JavaScript-native**, so it drops straight into a Node service. And
**SQLite** is perfect for a demo: it's a single file, needs no server, and Prisma supports it out
of the box.

---

## Day 2 — Building the service

### Prompt 2
> Scaffold a new Express service called `notes-service` that uses Prisma + SQLite. Model two
> tables: `Doctor` and `Note`, where a Doctor has many Notes (one-to-many). Show me the
> `schema.prisma` and explain how the relationship is expressed.

**What I was doing:** Creating the models — "model the resource with an ORM, add at least one
relationship".

**What I learned:** In Prisma, a relationship is a `@relation` on the child pointing to the
parent: `doctor Doctor @relation(fields: [doctorId], references: [id])`, plus `notes Note[]` on
the parent for the reverse direction. The `doctorId` field is the actual foreign key — a real
relational relationship, not just a stored ID.

---

### Prompt 3
> Now run the migration. Explain what `prisma migrate dev` actually does and show me the SQL it
> generates. I want to understand where the migration file comes from.

**What I was doing:** Generating the migration — the core "migrations" concept.

**What I learned:** `npx prisma migrate dev --name init` reads `schema.prisma` and
**auto-generates a real `migration.sql`** (with `CREATE TABLE` and the `FOREIGN KEY` constraint),
then applies it and records it. So I describe the models and **Prisma writes the SQL** — that's
the value of migrations: versioned, repeatable schema changes. (The latest Prisma 7 changed the
config format and broke the classic setup, so I pinned to stable Prisma 6.)

---

### Prompt 4
> Build the full CRUD for the Note resource: create, list (with an optional filter by doctor),
> get one, update, delete. Use a controller + routes structure. When I fetch a single note, I
> want the doctor's info joined in. Return the correct HTTP status codes.

**What I was doing:** Building the CRUD REST API end-to-end with proper REST conventions.

**What I learned:** Prisma's `.include: { doctor: true }` is how you do a join — it pulls the
related Doctor into the Note response. That's the relationship working at query time. Status-code
conventions: `201` create, `200` read/update, `404` not found, `409` duplicate unique field.

---

### Prompt 5
> Add input validation with Zod. A note needs a positive integer `doctorId`, a non-empty title
> (max 120 chars), and non-empty content. Invalid input should return `400` with a readable
> message *before* it hits the database. Put the schema in its own file and write a reusable
> validation middleware.

**What I was doing:** The "input validation & error handling (Zod)" requirement.

**What I learned:** Zod's `safeParse` returns `{ success, data, error }` — my middleware checks
`success` and maps `error.issues` into a friendly `400`. `z.coerce.number()` turns a numeric
string into a number. Keeping validation in middleware means the controller only sees clean data.

---

### Prompt 6
> Add a central error handler so I'm not repeating try/catch everywhere. It should turn thrown
> errors into the right HTTP responses, including common Prisma error codes. Wrap my async
> controllers so rejected promises reach it automatically.

**What I was doing:** Centralizing error handling — the other half of "validation & error
handling".

**What I learned:** An `asyncHandler` wrapper (`Promise.resolve(fn()).catch(next)`) removes the
need for try/catch in every controller. In the handler I map Prisma codes — `P2002` → `409`,
`P2025` → `404` — and everything else to `500`. One place, consistent responses.

---

## Day 3 — Linting, tests & verification

### Prompt 7
> Configure ESLint (flat config, ESLint 9+) for this Node/CommonJS service so it knows about Node
> and Jest globals, add a `lint` script, and get me to a clean pass.

**What I was doing:** The "configure a linter and commit a clean pass" requirement.

**What I learned:** ESLint 9 uses the flat `eslint.config.js` format where you declare
`languageOptions.globals` yourself. I also hit the newer `preserve-caught-error` rule — when you
`catch (e)` and throw a new error you should pass `{ cause: e }` so the original stack isn't lost.

---

### Prompt 8
> Write Jest unit tests for the Zod validation schema — valid input passes, empty title fails,
> missing content fails, a non-positive doctorId fails, string-number coercion works, and an
> empty update is rejected. Then run the linter and tests and confirm both are clean.

**What I was doing:** The "write AI-generated unit tests; review and verify them" requirement.

**What I learned:** Testing the Zod schema directly (calling `.safeParse()` and asserting
`.success`) is a clean, DB-free way to prove the validation rules. Final state: ESLint clean, all
tests green.

---

### Prompt 9
> Before I trust this, actually run the service and hit every endpoint with curl — create a
> doctor, create notes, fetch one with the doctor joined in, list doctors with their notes,
> update, delete, and confirm the validation error returns 400 and a missing doctor returns 404.
> Show me the real responses.

**What I was doing:** Verifying the API end-to-end against a running server, not just the code.

**What I learned:** The real JSON responses confirmed the relationship works *both* directions — a
note comes back with its `doctor` nested, and a doctor comes back with its `notes` array. Failure
cases returned the right codes (`400`, `404`). Live testing catches things unit tests don't.

---

## Day 4 — Understanding it

### Prompt 10
> I'm confused about two files: the generated `migration.sql` and my `noteSchema.js`. They both
> seem to say things like "title is required". Explain the difference clearly — when each runs,
> what level it works at, and why I need both.

**What I was doing:** Making sure I understand the concepts rather than just having the code.

**What I learned:** They're two different safety nets. `migration.sql` (SQL, runs **once**,
**database** level) builds the tables — `NOT NULL` is the database's hard guarantee.
`noteSchema.js` (Zod, runs on **every request**, **application** level) rejects bad input early
with a nice `400`. Good backends have both.

---

### Prompt 11
> Walk me through the whole folder structure of `notes-service` — what each file and folder is
> for, how a request flows from the URL down to the database, and which Week 2 concept each piece
> demonstrates. I want to be able to explain my own project.

**What I was doing:** Building a mental model of the architecture so I can defend it.

**What I learned:** The app is layered and a request passes through in order: **route** (which
URL) → **middleware** (is the input valid?) → **controller** (what to do) → **Prisma/db** (how to
store) → **SQLite**. Each layer has one job — exactly the "framework fundamentals + routing +
ORM" understanding this week is about.

---

## Day 5 — Running & testing tools

### Prompt 12
> How do I actually run and test this service? Show me the commands to start it, run the tests
> and linter, and hit the endpoints. I got "Cannot GET /" in the browser — is that an error?

**What I was doing:** Learning to run the service and test its endpoints.

**What I learned:** "Cannot GET /" is **not** an error — the root path `/` just has no route; only
`/health`, `/api/doctors`, `/api/notes` exist. The browser can only test `GET` endpoints. I added
a small root route that lists the endpoints so `/` isn't a dead end — and learned that Node loads
code only at startup, so after any change you must **restart the server**.

---

### Prompt 13
> Give me a ready-to-import API collection with all the notes-service endpoints pre-built so I can
> just click Send instead of typing each request.

**What I was doing:** Setting up an API client (Postman / Thunder Client) to demo the endpoints.

**What I learned:** I generated an importable collection with all the CRUD requests, plus a couple
of deliberate failure cases (empty title → 400, missing doctor → 404) so the validation and error
handling are easy to demonstrate. A `baseUrl` variable makes the port easy to change in one place.

---

## Summary

| # | Prompt Category | Key Concept Covered |
|---|---|---|
| 1 | Stack choice | Why Prisma (JS-native) + SQLite over Django/SQLAlchemy |
| 2 | Models & relationship | Prisma schema, Doctor → Notes one-to-many |
| 3 | Migrations | `prisma migrate dev`, generated `migration.sql`, foreign key |
| 4 | CRUD REST API | Full CRUD, `include` join, status code conventions |
| 5 | Validation | Zod schema + reusable validation middleware, 400s |
| 6 | Error handling | Central error handler, asyncHandler, Prisma error codes |
| 7 | Linting | ESLint flat config, clean pass |
| 8 | Unit tests | Jest, testing the Zod schema |
| 9 | Verification | End-to-end curl testing of every endpoint |
| 10 | Understanding | migrations vs validation (DB vs app level) |
| 11 | Architecture | Request flow through the layers |
| 12 | Running it | Commands, "Cannot GET /", root route, restart-on-change |
| 13 | API client | Postman / Thunder Client collection for the endpoints |

**Total significant prompts logged: 13**

**Week 2 deliverable:** `notes-service` — a CRUD REST API for the Note resource, modelled with
Prisma (ORM) on SQLite, with a Doctor → Notes relationship, real migrations, Zod input
validation, correct HTTP status codes, a clean ESLint pass, and reviewed Jest unit tests.

---
---

# Week 3 — Auth, Authorization, API Tests & Integration

**Goal:** add JWT authentication and role-based authorization to the Week 2 API, wire the Week 1
frontend to it so the app works end-to-end, and cover the whole thing with API and integration
tests.

## The Plan (before I started)

Week 2 left `notes-service` as an island: a working CRUD API with **no auth at all** and **no
caller** — nothing in the frontend ever hit it. Week 3 is about closing both gaps.

1. **Audit first, don't assume.** Before writing anything, find out which services the frontend is
   actually talking to. I suspected notes-service was orphaned but wanted evidence.
2. **Add JWT auth** to every `/api` route, verifying the token auth-service already mints.
3. **Add role-based authorization** — a rule that depends on *what you are*, not just *what you own*.
4. **Wire the frontend** to notes-service so the video-call page does real CRUD against it.
5. **Test it properly**: API tests for auth + CRUD + error paths, and an integration test that runs
   the happy path across a service boundary.

The interesting design problem I knew was coming: notes-service has its own SQLite database and
**no appointment data**, so it physically cannot answer "is this caller allowed to see this
consultation's notes?" on its own. That question has to cross a service boundary.

---

## Day 1 — Auditing what was actually connected

### Prompt 14

> As a senior full stack developer, list the remaining wiring between the frontend and the backend
> services. Check deeply whether each service is connected to the frontend or not, and list the
> issues.

**What I was doing:** Establishing ground truth before touching code, rather than trusting my
memory of what I'd built.

**What I learned:** The audit found more than I expected. `notes-service` was **completely
orphaned** — the BFF proxy and route existed, but *zero* lines of frontend code called
`/api/notes`. Worse, the feature it was meant to serve was already implemented twice: the video
page was saving clinical notes to appointment-service's *own* Mongo `Note` model. Two parallel note
systems, and the UI used the wrong one.

The lesson: **"I wrote the proxy" is not the same as "it's wired."** Grep for the caller.

---

## Day 2 — Auth, authorization, and the cross-service problem

### Prompt 15

> Wire the video page notes to notes-service.

**What I was doing:** The core Week 3 integration task.

**What I learned:** This was *not* a one-line repoint, and the AI pushed back before writing code —
correctly. Three things blocked it:

1. **The schema couldn't represent the data.** notes-service's `Note` was
   `{title, content, doctorId: Int}`. The video page sends a body, an appointment, and an author.
   No field mapped.
2. **The foreign key pointed at the wrong universe.** `doctorId` is a SQLite autoincrement `Int`;
   real doctors are Mongo `ObjectId` strings from auth-service. Nothing connected them.
3. **There was no auth at all.** `GET /api/notes` would happily return every note belonging to
   every doctor, to anyone.

I chose to **keep the Prisma one-to-many relation** (it's the Week 2 deliverable) and add
`Doctor.externalId` — the auth-service user id — so the relation survives while pointing at real
platform users. The service upserts a local `Doctor` row from the JWT on write.

### Prompt 16

> How should notes-service authorize access, given it can't see appointments?

**What I was doing:** Solving the cross-service authorization problem.

**What I learned:** This is the genuinely interesting bit of Week 3. A JWT proves **who you are**;
it says nothing about **whether this consultation is yours**. notes-service has no appointment
table, so it cannot decide.

The answer: **ask the service that owns the data.** notes-service calls
`GET /api/appointments/:id` on appointment-service, forwarding the caller's own token.
appointment-service *already* restricts that endpoint to the patient and doctor on the appointment
— so a `200` coming back **is** the participant check, and a `403` means they have no business
here. No duplicated logic, one owner per fact.

The cost is real and worth stating: notes now depend on appointment-service being up, and every
read costs an internal HTTP hop. That's the price of not duplicating the authorization rule.

### Prompt 17 — Role-based authorization

> Add at least one role-based authorization rule.

**What I was doing:** The explicit Week 3 requirement.

**What I learned:** I'd been conflating three *different* questions, and the assignment forced me to
separate them:

| Question | Mechanism | Example here |
|---|---|---|
| Who are you? | **Authentication** (JWT) | `authenticate` — verify the signature |
| What may your *role* do? | **Authorization (RBAC)** | `authorizeRole('doctor')` |
| Is this *record* yours? | **Ownership / participation** | author check, appointment participant check |

RBAC is **record-independent**: a patient may not delete a clinical note *no matter whose it is* —
not even their own. That's a policy about the role, and it's a different rule from "you may only
edit a note you wrote."

The rules I added:

- `DELETE /api/notes/:id` → **doctors only**. Clinical records are not patient-destroyable. The
  author check still applies on top, so a doctor can only delete notes *they* wrote.
- `POST /api/doctors` → **doctors only**.

Both layers stack: role first, then ownership. The frontend hides the Delete button from patients,
but the API refuses them regardless — **the UI is a convenience, not a security boundary.**

---

## Day 3 — Reviewing the AI's own work

### Prompt 18

> As a senior developer, check again.

**What I was doing:** Asking for an adversarial review of code the AI had just written and declared
finished.

**What I learned:** **This prompt found a real bug the AI had shipped.** Its `assertCanAccess`
helper did nothing when a note had no `appointmentId` — the comment even rationalised it
("standalone notes carry no patient data"). That was an assumption, not a guarantee: any logged-in
user could read, edit or delete any standalone note.

It had passed its own tests because it only tested the consultation path. **Green tests on the paths
you thought of prove nothing about the paths you didn't.** I now ask for a second adversarial pass
as a matter of routine, and specifically ask *which branches were never executed*.

### Prompt 19

> Fix the Postman collection.

**What I was doing:** The Week 2 collection was now broken — every request was unauthenticated, so
all nine would 401 against the newly secured API.

**What I learned:** Running it caught a subtlety I'd have missed: my "no token → 401" test
**returned 200**. Cookies are scoped **by domain, not by port** — so once you log in against
auth-service on `:3001`, Postman's cookie jar sends that same token to notes-service on `:3006`.
Dropping the `Authorization` header does **not** make you anonymous when the service also accepts a
cookie. The test was lying, not the service. It now runs *before* login, with the jar cleared.

---

## Day 4 — Tests

### Prompt 20

> Write at least 5 API tests covering auth + CRUD + error paths, and one integration test that runs
> the happy path end to end.

**What I was doing:** The Week 3 testing requirement.

**What I learned:** The distinction between the test types finally clicked by building them:

- **Unit test** (Week 2, `noteSchema.test.js`) — a pure function. No HTTP, no DB. Does Zod reject an
  empty title?
- **API test** (`notes.api.test.js`) — drives the real Express app through **supertest**, over real
  HTTP, against a real database. Asserts *status codes* and *bodies*: 401 without a token, 403 for
  the wrong role, 400 for bad input, 404 for a missing parent, 201/200 on success.
- **Integration test** (`consultation.integration.test.js`) — the same, but **across a service
  boundary**: a real appointment-service stub listens on a real port, and notes-service really calls
  it over the wire to make its authorization decision.

Two practical things I'd have got wrong alone:

1. **Tests must not touch the dev database.** `jest.setup.js` overrides `DATABASE_URL` to `test.db`
   *before* Prisma is constructed (dotenv doesn't overwrite variables that are already set), and
   `jest.globalSetup.js` runs the **real migrations** against it — so the tests exercise the actual
   schema, foreign keys and all, not a mock.
2. **`maxWorkers: 1`.** Jest parallelises by default, and parallel suites sharing one SQLite file
   truncate each other's tables mid-assertion.

The test I'm most glad I wrote asserts a **negative**: that a refused request left the record
unchanged. It's not enough that the attacker got a 403 — the data has to still be there afterwards.

---

## Summary — Week 3

| # | Prompt Category | Key Concept Covered |
|---|---|---|
| 14 | Integration audit | Finding an orphaned service; "wired" ≠ "a proxy exists" |
| 15 | Frontend ↔ backend | Schema migration to carry real identity across services |
| 16 | Cross-service authz | Delegate the check to the service that owns the fact |
| 17 | **RBAC** | Role vs ownership vs authentication — three distinct questions |
| 18 | Adversarial review | Asking the AI to re-check itself found a real shipped bug |
| 19 | API client | Cookies are domain-scoped, not port-scoped |
| 20 | **API + integration tests** | supertest, isolated test DB, real migrations, negative assertions |

**Total significant prompts logged: 20** (13 in Week 2, 7 in Week 3)

**Week 3 deliverable:** `notes-service` now has **JWT authentication** on every `/api` route, a
**role-based authorization rule** (`DELETE` is doctors-only) layered on top of ownership and
appointment-participant checks, and it is **wired to the Week 1 frontend** — the video-call page
performs full Create / Read / Update / Delete against it with a real login. Covered by **31 backend
tests**: Zod unit tests, API tests over supertest (auth, RBAC, CRUD, error paths), and an
integration test that runs the happy path across a live service boundary.
