# prompts.md — Week 2 Prompt Log
**Intern:** Muhammad Usama
**Program:** Arbisoft AI-Focused Internship 2026
**Week:** 2 — Backend, REST, CRUD & ORM

This file documents the significant prompts I used while building the backend during Week 2,
in the order I actually used them, with a short note on what I was trying to do and what I
learned. Before the prompts, I've written down the plan I made at the start of the week so it's
clear how I approached the assignment.

---

## The Plan (before I started)

The assignment asks me to understand the backend half of a web app: HTTP, REST, CRUD, a
framework, routing, an ORM (models/migrations/relationships), validation, linting, and unit
tests. The concrete deliverable is a **CRUD REST API for one resource, modelled with an ORM,
with at least one relationship, input validation, correct status codes, a clean linter pass,
and AI-generated unit tests.**

Here's how I decided to tackle it:

1. **Audit what I already have.** I already scaffolded a backend from earlier work
   (auth, appointments, files, notifications — using Express + MongoDB/Mongoose). First step is
   to honestly check it against the Week 2 checklist and find the gaps, rather than assume it's
   done.
2. **Close the tooling gaps first.** From the audit I expected the missing pieces to be
   **linting** and **unit tests**, since those are explicit checklist items. Set up ESLint +
   Jest and get a clean pass.
3. **Handle the ORM/migrations concept properly.** My existing DB is MongoDB via Mongoose,
   which is an ODM, not an ORM — and it has no migrations (it's schemaless). The assignment
   names Prisma/SQLAlchemy/Django ORM, all of which are SQL-based with real migrations. So to
   demonstrate *migrations* and a *classic relationship* honestly, I'll build one small,
   self-contained service using **Prisma + SQLite**.
4. **Keep the Week 2 deliverable clean.** The new service should be pure Week 2 — no auth, no
   frontend wiring (that's Week 3). One resource, one relationship, full CRUD, validation.
5. **Prove it works and document it.** Run the API end-to-end, write unit tests, keep the
   linter clean, and write docs so I actually understand each piece (not just paste code).

Decision: the demo resource is **Notes**, with a **Doctor → Notes** one-to-many relationship
(the assignment's own "User → Notes" example, adapted to my medical domain). Stack: **Express +
Prisma + SQLite + Zod + Jest + ESLint**.

---

## Day 1 — Auditing the existing backend

### Prompt 1
> I have an existing Express backend split into a few services (auth, appointments, files,
> notifications) using MongoDB and Mongoose. Can you go through it and honestly tell me, as a
> senior engineer, which Week 2 requirements are already met and which are missing? The
> checklist is: CRUD REST API, ORM with a relationship, input validation + correct status
> codes, a linter with a clean pass, and unit tests.

**What I was doing:** Getting an honest gap analysis before writing any code, so I don't waste
time re-building things that already work.

**What I learned:** The CRUD, routing, validation and status codes were already there, but two
checklist items were completely missing — **no linter was configured** and there were **zero
unit tests** (the `test` script was still the default `exit 1` stub). Also learned an important
distinction: Mongoose is an **ODM**, not an **ORM**, and MongoDB has **no migrations** because
it's schemaless. That flagged the ORM/migrations concept as something I'd have to address
separately.

---

## Day 1 — Setting up linting

### Prompt 2
> Set up ESLint (flat config, ESLint 9+) for my Node/CommonJS services. It needs to know about
> Node globals and Jest globals so it doesn't flag `process`, `describe`, etc. Add a `lint`
> script and get me to a clean pass. Show me what errors it finds and fix the real ones.

**What I was doing:** Configuring the linter across the services to satisfy the "configure a
linter and commit a clean pass" requirement.

**What I learned:** ESLint 9 uses the flat `eslint.config.js` format where you declare
`languageOptions.globals` yourself instead of using an `env` block. I also hit ESLint's newer
`preserve-caught-error` rule — if you `catch (e)` and throw a new error, you should pass the
original as `{ cause: e }` so you don't lose the stack trace. Small change, but it's a real
best practice I didn't know about.

---

## Day 1–2 — Writing unit tests

### Prompt 3
> I want AI-generated unit tests with Jest, but I want them to be *real* tests I can review, not
> fake ones. Focus on pure logic that doesn't need a database — like my input validator
> middleware and my JWT/authorization helpers. Write them, then explain each case so I can
> verify they actually test something meaningful.

**What I was doing:** Meeting the "write AI-generated unit tests; review and verify them"
requirement — and specifically choosing test targets that are pure functions so the tests are
fast and reliable.

**What I learned:** The trick to good unit tests is picking code with no side effects. My
validation middleware and role-check middleware are pure (input → output), so I can test them
by passing a fake `req`/`res` and a Jest mock `next()` and asserting what got called. Tests that
need a live DB are integration tests — those belong to Week 3, not here.

---

## Day 2 — Understanding the ORM / migrations gap

### Prompt 4
> Explain clearly: my backend uses MongoDB with Mongoose. The assignment lists ORM concepts as
> "models, migrations, relationships (Django ORM / SQLAlchemy / Prisma)". Does my stack cover
> all of these? If something is missing or doesn't apply, tell me honestly and explain *why*.

**What I was doing:** Making sure I actually understand the ORM part of the assignment instead
of hand-waving it.

**What I learned:** Models ✅ and relationships (sort of) ✅, but **migrations genuinely don't
apply to MongoDB** — it's schemaless, so there's no `CREATE TABLE` / `ALTER TABLE` step to
version. Migrations are a SQL-world concept. Also my "relationships" were denormalized string
IDs across services, not a real foreign key with a join. So to demonstrate the concept properly
I'd need a relational database.

---

### Prompt 5
> I want to actually demonstrate migrations and a real relationship, using one of the ORMs the
> assignment names. My whole backend is JavaScript. Which is the easiest to add — Django ORM,
> SQLAlchemy, or Prisma — and what's the plan? I don't want to break my existing services.

**What I was doing:** Choosing the ORM and planning the smallest, safest way to demonstrate
migrations.

**What I learned:** Django ORM and SQLAlchemy are Python — adding either means a whole new
language in my repo. **Prisma is JavaScript-native**, so it drops straight into a Node service.
And I learned to use **SQLite** for the database: it's a single file, needs zero setup, and
Prisma supports it out of the box — perfect for a demo. The plan became: build one isolated
`notes-service` rather than risk rewriting a working service.

---

## Day 3 — Building the Prisma + SQLite service

### Prompt 6
> Scaffold a new Express service called `notes-service` that uses Prisma + SQLite. Model two
> tables: `Doctor` and `Note`, where a Doctor has many Notes (one-to-many). Show me the
> `schema.prisma` and explain how the relationship is expressed.

**What I was doing:** Creating the models — the "model the resource with an ORM, add at least
one relationship" requirement.

**What I learned:** In Prisma, a relationship is a `@relation` on the child pointing to the
parent: `doctor Doctor @relation(fields: [doctorId], references: [id])`, plus `notes Note[]` on
the parent for the other direction. The `doctorId` field is the actual foreign key. This is a
real relational relationship, not just a stored ID.

---

### Prompt 7
> Now run the migration. Explain what `prisma migrate dev` actually does and show me the SQL it
> generates. I want to understand where the migration file comes from.

**What I was doing:** Generating the migration — the piece that was impossible with MongoDB.

**What I learned:** `npx prisma migrate dev --name init` reads `schema.prisma` and
**auto-generates a real `migration.sql`** file (with `CREATE TABLE` and the `FOREIGN KEY`
constraint), then applies it to the database and records it. So *I* describe the models and
**Prisma writes the SQL** — that's the whole value of migrations: versioned, repeatable schema
changes. (Side note: the latest Prisma 7 changed the config format and broke the classic setup,
so I pinned to the stable Prisma 6 which uses the well-documented `url = env("DATABASE_URL")`.)

---

### Prompt 8
> Build the full CRUD for the Note resource: create, list (with an optional filter by doctor),
> get one, update, delete. Use a controller + routes structure. When I fetch a single note, I
> want the doctor's info joined in. Return the correct HTTP status codes (201 on create, 404
> when not found, etc.).

**What I was doing:** Building the CRUD REST API end-to-end with proper REST conventions.

**What I learned:** Prisma's `.include: { doctor: true }` is how you do a join — it pulls the
related Doctor into the Note response. That's the relationship working at query time. I also
firmed up the status-code conventions: `201` for a successful create, `200` for reads/updates,
`404` when the record doesn't exist, `409` for a duplicate unique field.

---

### Prompt 9
> Add input validation with Zod. A note needs a positive integer `doctorId`, a non-empty title
> (max 120 chars), and non-empty content. Invalid input should return `400` with a readable
> error message *before* it hits the database. Put the schema in its own file and write a
> reusable validation middleware.

**What I was doing:** The "input validation & error handling (Zod)" requirement.

**What I learned:** Zod's `safeParse` returns `{ success, data, error }` — so my middleware can
check `success`, and on failure map `error.issues` into a friendly list and return `400`. I also
learned `z.coerce.number()` will turn a numeric string into a number, which is handy. Keeping
validation in middleware means the controller only ever sees clean data.

---

### Prompt 10
> Add a central error handler so I'm not repeating try/catch everywhere. It should turn thrown
> errors into the right HTTP responses, including common Prisma error codes (like unique
> constraint violations). Wrap my async controllers so rejected promises reach it automatically.

**What I was doing:** Centralizing error handling — the other half of "validation & error
handling".

**What I learned:** An `asyncHandler` wrapper (`Promise.resolve(fn()).catch(next)`) removes the
need for try/catch in every controller. In the error handler I can check Prisma's error codes —
`P2002` (unique violation) → `409`, `P2025` (record not found) → `404` — and map everything else
to `500`. One place, consistent responses.

---

## Day 3 — Verifying it works

### Prompt 11
> Before I trust this, actually run the service and hit every endpoint with curl — create a
> doctor, create notes, fetch one with the doctor joined in, list doctors with their notes,
> update, delete, and confirm the validation error returns 400 and a missing doctor returns
> 404. Show me the real responses.

**What I was doing:** Verifying the API end-to-end against a running server, not just trusting
the code.

**What I learned:** Seeing the real JSON responses confirmed the relationship works *both*
directions — a note comes back with its `doctor` nested, and a doctor comes back with its
`notes` array. And the failure cases returned the right codes (`400` for empty title, `404` for
a non-existent doctor). Testing against a live server catches things unit tests don't.

---

### Prompt 12
> Write Jest unit tests for the Zod validation schema — valid input passes, empty title fails,
> missing content fails, a non-positive doctorId fails, string-number coercion works, and an
> empty update is rejected. Then run the linter and tests and confirm both are clean.

**What I was doing:** Adding the unit tests for the new service and confirming the quality gates.

**What I learned:** Testing the Zod schema directly (calling `.safeParse()` and asserting
`.success`) is a clean, DB-free way to prove the validation rules. Final state: ESLint clean,
all tests green.

---

## Day 4 — Making sure I actually understand it

### Prompt 13
> I'm confused about two files: the generated `migration.sql` and my `noteSchema.js`. They both
> seem to say things like "title is required". Explain the difference between them clearly —
> when each runs, what level it works at, and why I need both.

**What I was doing:** Making sure I understand the concepts rather than just having the code.

**What I learned:** They're two different safety nets. `migration.sql` (SQL, runs **once**,
**database** level) builds the tables — `NOT NULL` is the database's hard guarantee.
`noteSchema.js` (Zod, runs on **every request**, **application** level) is the friendly bouncer
that rejects bad input early with a nice `400` message. Good backends have both: validate early
for good UX, enforce at the database for safety.

---

### Prompt 14
> Walk me through the whole folder structure of `notes-service` — what each file and folder is
> for, how a request flows from the URL down to the database, and which Week 2 concept each
> piece demonstrates. I want to be able to explain my own project.

**What I was doing:** Building a mental model of the architecture so I can defend it.

**What I learned:** The app is layered and a request passes through the layers in order:
**route** (which URL) → **middleware** (is the input valid?) → **controller** (what to do) →
**Prisma/db** (how to store) → **SQLite**. Each layer has one job. That separation is exactly
the "framework fundamentals + routing + ORM" understanding this week is about.

---

## Summary

| # | Prompt Category | Key Concept Covered |
|---|---|---|
| 1 | Backend audit | Honest gap analysis vs the checklist; ODM vs ORM |
| 2 | Linting | ESLint flat config, Node/Jest globals, clean pass |
| 3 | Unit tests | Jest, testing pure logic (validators, middleware) |
| 4–5 | ORM decision | Why MongoDB has no migrations; choosing Prisma + SQLite |
| 6 | Models & relationship | Prisma schema, Doctor → Notes one-to-many |
| 7 | Migrations | `prisma migrate dev`, generated `migration.sql`, foreign key |
| 8 | CRUD REST API | Full CRUD, `include` join, status code conventions |
| 9 | Validation | Zod schema + reusable validation middleware, 400s |
| 10 | Error handling | Central error handler, asyncHandler, Prisma error codes |
| 11 | Verification | End-to-end curl testing of every endpoint |
| 12 | Tests & lint | Jest validation tests, clean lint + test run |
| 13–14 | Understanding | migrations vs validation; request flow through the layers |

**Total significant prompts logged: 14**

**Week 2 deliverable:** `notes-service` — a CRUD REST API for the Note resource, modelled with
Prisma (ORM) on SQLite, with a Doctor → Notes relationship, real migrations, Zod input
validation, correct HTTP status codes, a clean ESLint pass, and reviewed Jest unit tests.
