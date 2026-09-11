# EMR Backend — ElysiaJS + Prisma + PostgreSQL + Gemini

Type-safe clinic backend built with Bun, Elysia, Prisma 7, PostgreSQL, and Google Gemini. Two roles (doctor, receptionist), a per-doctor queue with one patient in the room at a time, and an AI pipeline that structures consultation notes.

---

## Prerequisites

- [Bun](https://bun.sh) (v1.4+)
- [Docker](https://www.docker.com) & Docker Compose

---

## Quickstart

Run the following commands from the `backend/` directory:

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Install dependencies
bun install

# 3. Spin up PostgreSQL container (emr + emr_test databases)
bun run db:up

# 4. Run database migrations
bun run db:migrate

# 5. Seed demo data: doctor + receptionist, patients, appointments, prior consultations.
#    Clears patients, appointments and consultations first; staff and sessions are kept.
bun run db:seed

# 6. Start development server with hot-reloading
bun run dev
```

The API will be running on `http://localhost:3001`.
Swagger interactive documentation is available at `http://localhost:3001/swagger`.

---

## Running Tests

Tests run against a dedicated `emr_test` database container instance:

```bash
bun test
# or
bun run test
```

To run TypeScript type checks:

```bash
bun run typecheck
```

---

## Environment Variables & Gemini AI

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for primary database | `postgresql://emr:emr@localhost:5432/emr` |
| `TEST_DATABASE_URL` | PostgreSQL connection string for test suite | `postgresql://emr:emr@localhost:5432/emr_test` |
| `GEMINI_API_KEY` | Google Gemini API key (optional for startup/demos) | `""` |
| `AI_PROVIDER` | Active AI provider (`gemini` or `fake`) | `gemini` |
| `AI_MODEL` | Gemini model ID | `gemini-2.5-flash` |
| `AI_TIMEOUT_MS` | Upstream Gemini call timeout in ms | `20000` |
| `PORT` | HTTP server port | `3001` |
| `CORS_ORIGIN` | Allowed CORS origin (Frontend) | `http://localhost:3000` |

### Working Without an API Key

- If `GEMINI_API_KEY` is left blank while `AI_PROVIDER=gemini`:
  - The server boots normally.
  - All non-AI endpoints (appointments, patients, consultations) remain fully operational.
  - The `/ai/structure-consultation` route returns `503 Service Unavailable` with `AI_UNAVAILABLE`, allowing doctors to manually write and save consultation notes without disruption.
- Set `AI_PROVIDER=fake` in `.env` to enable full end-to-end clinical note structuring and AI draft demos without requiring an external Gemini API key.

---

## AI patient history summary

`POST /ai/patient-summary` `{ patientId }` → `{ summary, model, latencyMs, basedOn }`. The service builds a dated plain-text record from the patient's saved `finalNote`s only (never raw notes or AI drafts), and the prompt forbids diagnosis, inference and advice, capping the reply at a few sentences. Empty history returns `400 VALIDATION`; an empty model reply returns `502 AI_INVALID_OUTPUT`. Summaries are not stored.

## Authentication

Cookie sessions, no external dependency:

- `POST /auth/sign-in` `{ email, password }` → sets an `httpOnly`, `SameSite=Lax` `session` cookie (7 days) and returns `{ doctor }`, where `doctor.role` is `DOCTOR` or `RECEPTIONIST`. The key is named `doctor` for backwards compatibility; it is any staff member.
- `GET /auth/me` → `{ doctor }` or `401 UNAUTHORIZED`.
- `POST /auth/sign-out` → revokes the session row and clears the cookie.
- Every other route except `/health` requires a valid session (`401 UNAUTHORIZED`) and the right role (`403 FORBIDDEN`). Consultations are written with the signed-in doctor's id.

### Roles

| | Doctor | Receptionist |
| --- | --- | --- |
| Schedule, patients, doctors list | ✓ | ✓ |
| Register and edit patients, book, reschedule, cancel, check in | ✓ | ✓ |
| Mark a patient absent (`NO_SHOW`) | | ✓ |
| Put a patient in the room, step out, complete | ✓ | |
| Read consultation history, save consultations, AI endpoints | ✓ | |

Guards live in `src/auth.ts`: `requireRole(...)` wraps whole route groups in `app.ts`, and `assertRole(...)` guards single routes inside a shared group.

Passwords are hashed with `Bun.password` (argon2id). Session tokens are random UUIDs stored in the `Session` table; expired rows are deleted on first use.

Seeded demo accounts: doctor `vivek@gmail.com`, receptionist `recp@gmail.com`, password `pass123`. They are defined once in `prisma/staff.ts`, used by the seed locally and by `prisma/ensure-staff.ts` on every deploy.

## Appointments: states, room and queue

```
BOOKED ──check in──▶ WAITING ──start──▶ IN_CONSULTATION ──save──▶ COMPLETED
  │                    │  ▲                  │
  │                    ▼  │ arrived          └──step out──▶ WAITING
  │                  NO_SHOW
  └──────────────── CANCELLED ◀──────── (from BOOKED, WAITING or NO_SHOW; "restore" returns it to BOOKED)
```

- `BOOKED` is on the schedule but not checked in. It never blocks anyone.
- **One in the room.** A doctor can have one `IN_CONSULTATION` appointment. Enforced by the partial unique index `Appointment_one_active_per_doctor`; a second simultaneous start gets `409 ALREADY_IN_CONSULTATION` with the room holder in `details`.
- **Queue order.** A patient may start only when nobody is in the room and every `WAITING` appointment booked earlier that day is done. Otherwise `409 QUEUE_ORDER` names who is first. `NO_SHOW` and `CANCELLED` leave the queue without moving anyone's time; a returning no-show may go straight in when the room is free.
- **One per slot.** `Appointment_doctor_slot` makes `(doctorId, scheduledAt)` unique among non-cancelled appointments: double-booking and rescheduling into a taken slot return `409 CONFLICT`. Booking a time in the past returns `400 VALIDATION` (five-minute grace for walk-ins).
- Saving a consultation for a `WAITING` or `BOOKED` appointment runs the same room and queue checks, so the rules cannot be bypassed by skipping "start". Saving completes the appointment.

Both partial indexes are hand-written in `prisma/migrations` because Prisma's schema language cannot express them; `prisma migrate diff` ignores them, so they survive future migrations. The transition table and who may perform each move is `TRANSITIONS` in `src/services/appointment.service.ts`; the room and queue check is `src/services/queue.ts`.

### Endpoints added for the front desk

- `POST /appointments` `{ patientId, doctorId, scheduledAt, reason, status? }` → `201`. `status` may be `WAITING` for a walk-in who is already here.
- `PATCH /appointments/:id` with `{ scheduledAt?, reason? }` reschedules (refused once the appointment is `IN_CONSULTATION` or `COMPLETED`); with `{ status }` it moves state according to the transition table and the caller's role.
- `GET /appointments?patientId=…` → every appointment for one patient, newest first, ignoring the day window.
- `GET /doctors` → bookable staff.
- `POST /patients` → `201`, or `409 CONFLICT` with `{ patientId, name }` in `details` when the phone number already exists; send `allowDuplicate: true` to override. `PATCH /patients/:id` edits demographics, allergies and conditions. `GET /patients?q=` matches names and phone digits.

## Architecture

```
                      [ Next.js Frontend ]
                               │ (HTTP / JSON)
                               ▼
                    [ ElysiaJS App / Routes ]
                   (TypeBox Route Validation)
                               │
                               ▼
                     [ Service Layer ]
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   [ Domain Services ]                    [ AI Service ]
(Appointments + queue/room,              (Try-Validate &
 Patients, Consultations,                  Repair Loop)
 Staff)
            │                                     │
            │                           ┌─────────┴─────────┐
            │                           ▼                   ▼
            │                   [ GeminiProvider ]  [ FakeAiProvider ]
            │                    (Google GenAI)
            │                           │
            ▼                           ▼
      [ Prisma 7 ]             [ Gemini 2.5 Flash ]
   (@prisma/adapter-pg)
            │
            ▼
   [ PostgreSQL 16 ]
```

### AI Structuring Pipeline & Validation

1. **Provider Isolation**: All LLM interactions are wrapped behind the `AiProvider` interface (`GeminiProvider` and `FakeAiProvider`).
2. **Deterministic Output**: Uses `responseMimeType: "application/json"` with schema constraints and `temperature: 0`.
3. **Fence & Prose Stripping**: Removes markdown backticks (```` ```json ````) or extraneous model commentary.
4. **Lenient Coercion & Strict Validation**:
   - `LooseNoteSchema`: Permissively parses fields and strictly rejects unrecognized keys.
   - `normalizeNote`: Coerces strings to arrays, trims whitespace, drops empty strings, dedupes case-insensitively, and converts empty strings to `null`.
   - `StructuredNoteSchema`: Final strict validation gate ensuring type compliance.
5. **Self-Healing Repair Pass**: If attempt 1 fails schema validation, a second request is automatically sent to the LLM containing the previous output and the exact schema error to repair the response before returning an error.

---

## Known Trade-offs & Design Decisions

- **Two seeded accounts, no sign-up**: one doctor and one receptionist. There is no sign-up or password reset; accounts are created by the seed, the deploy step, or directly in the database.
- **Queue and room are per doctor**: two doctors can consult at once. The clinic is treated as a single site.
- **The room is released by the app, not by time**: closing the browser mid-consultation leaves the appointment `IN_CONSULTATION` until the doctor reopens it and steps out or saves. There is no heartbeat.
- **Server-Local "Today"**: Appointment date filtering calculates "today" using the server's local midnight timestamp.
- **Direct Prisma Calls**: In accordance with modern TypeScript best practices, services call Prisma directly rather than introducing an redundant repository layer over Prisma's built-in query client.
- **Doctor-Verified Allergies**: Patient allergies and chronic conditions are presented prominently alongside the clinical editor, while prescription cross-checking remains the medical practitioner's responsibility.

---

## Deployment

The backend runs on Vercel's Bun runtime (`vercel.json`, `index.ts` re-exports the Elysia app). The build command is:

```
DATABASE_URL="$DIRECT_URL" bunx prisma migrate deploy && DATABASE_URL="$DIRECT_URL" bun prisma/ensure-staff.ts
```

`DIRECT_URL` is the non-pooled connection, which Prisma migrations need. `DATABASE_URL` (pooled) is what the running app uses. Every deploy therefore applies pending migrations and upserts the two demo accounts; nothing else in the database is touched. A failed migration fails the build and leaves the previous deployment live.
