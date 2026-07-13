# notes-service

A small REST API that demonstrates the **Week 2 backend concepts** with a real SQL ORM:
**Prisma + SQLite**, versioned **migrations**, and a **one-to-many relationship** (`Doctor → Notes`).

Unlike the other services (which use MongoDB + Mongoose, an ODM with no migrations), this
service uses a relational database so the migration + relationship concepts are demonstrable
in real, runnable code.

## Stack

| Concern | Choice |
|---|---|
| Framework | Express |
| ORM | Prisma 6 |
| Database | SQLite (file-based, zero setup) |
| Validation | Zod |
| Tests | Jest |
| Lint | ESLint |

## Data model (`prisma/schema.prisma`)

```
Doctor (1) ───< (many) Note
```

- `Doctor` — id, name, email (unique), specialization
- `Note` — id, title, content, timestamps, **doctorId (foreign key → Doctor.id)**

The foreign key is created by the migration in `prisma/migrations/*/migration.sql`.

## Setup

```bash
npm install
npx prisma migrate dev --name init   # creates dev.db + applies migrations
```

## Run

```bash
npm start        # http://localhost:3005
```

## API

| Method | URL | Description |
|---|---|---|
| POST | `/api/doctors` | Create or update a doctor. Requires `externalId` (the auth-service user id), `name`, `email`. Upserts on `externalId`, the same key the consultation-note flow uses, so one doctor never ends up split across two rows. |
| GET | `/api/doctors` | List doctors **with their notes** (relationship) |
| POST | `/api/notes` | Create a note (validated, must reference an existing doctor) |
| GET | `/api/notes` | List notes (`?doctorId=` to filter) |
| GET | `/api/notes/:id` | Get one note **with its doctor joined in** (`include`) |
| PUT | `/api/notes/:id` | Update a note |
| DELETE | `/api/notes/:id` | Delete a note |

Status codes: `201` create, `200` ok, `400` validation, `404` not found, `409` duplicate email.

## Migrations

```bash
npm run migrate          # create + apply a new migration (prisma migrate dev)
npm run migrate:status   # show which migrations are applied
```

## Test & lint

```bash
npm test        # Jest — Zod validation unit tests
npm run lint    # ESLint — clean pass
```

## Week 2 concepts covered here

- **ORM** — Prisma models
- **Migrations** — real versioned SQL in `prisma/migrations/`
- **Relationship** — `Doctor` hasMany `Note` (foreign key + `include`)
- **CRUD REST API** — full Create/Read/Update/Delete on Notes
- **HTTP** — methods, status codes, request/response
- **Routing + middleware** — Express router + Zod validation middleware
- **Validation & error handling** — Zod + central error handler
- **Linting** — ESLint clean pass
- **Unit tests** — Jest
