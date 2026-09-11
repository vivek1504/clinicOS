# EMR Backend — ElysiaJS + Prisma + PostgreSQL + Gemini

High-performance, type-safe electronic medical records (EMR) backend API built with Bun, Elysia, Prisma 7, PostgreSQL, and Google Gemini.

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

# 5. Seed initial clinical data (patients, appointments, prior consultations)
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

- `POST /auth/sign-in` `{ email, password }` → sets an `httpOnly`, `SameSite=Lax` `session` cookie (7 days) and returns `{ doctor }`.
- `GET /auth/me` → `{ doctor }` or `401 UNAUTHORIZED`.
- `POST /auth/sign-out` → revokes the session row and clears the cookie.
- Every other route except `/health` requires a valid session and answers `401 UNAUTHORIZED` otherwise. Consultations are written with the signed-in doctor's id.

Passwords are hashed with `Bun.password` (argon2id). Session tokens are random UUIDs stored in the `Session` table; expired rows are deleted on first use.

Seeded demo accounts: doctor `vivek@gmail.com`, receptionist `recp@gmail.com`, password `pass123`.

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
(Appointments, Patients,                 (Try-Validate &
    Consultations)                         Repair Loop)
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

- **Single seeded doctor**: sign-in exists, but there is no sign-up or password reset; accounts are created by seeding or directly in the database.
- **Server-Local "Today"**: Appointment date filtering calculates "today" using the server's local midnight timestamp.
- **Direct Prisma Calls**: In accordance with modern TypeScript best practices, services call Prisma directly rather than introducing an redundant repository layer over Prisma's built-in query client.
- **Doctor-Verified Allergies**: Patient allergies and chronic conditions are presented prominently alongside the clinical editor, while prescription cross-checking remains the medical practitioner's responsibility.
