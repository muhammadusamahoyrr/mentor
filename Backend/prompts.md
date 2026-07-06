# prompts.md — Week 2 Prompt Log
**Intern:** Muhammad Usama
**Program:** Arbisoft AI-Focused Internship 2026
**Week:** 2 — Backend, REST, CRUD & ORM

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
