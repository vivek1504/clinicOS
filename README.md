<!-- prettier-ignore -->
<div align="center">

# ClinicOS

**Clinic workspace for doctors and the front desk: check-in, queue and booking on one side, AI-structured consultation notes on the other.**

[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%20v1.4+-black?style=flat-square&logo=bun)](https://bun.sh)
[![Framework: Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Backend: ElysiaJS](https://img.shields.io/badge/Backend-ElysiaJS-violet?style=flat-square&logo=elysia)](https://elysiajs.com)
[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![ORM: Prisma 7](https://img.shields.io/badge/ORM-Prisma%207-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io)
[![AI: OpenRouter](https://img.shields.io/badge/AI-OpenRouter-6467F2?style=flat-square)](https://openrouter.ai)
[![Language: TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

<br />

[Overview](#overview) • [Consultation Workflow](#consultation-workflow) • [Architecture](#architecture) • [Key Features](#key-features) • [Screens](#screens) • [Quickstart](#quickstart) • [Environment Variables](#environment-variables) • [API Reference](#api-reference) • [Testing](#testing) • [Deployment](#deployment)

</div>

---

## Overview

**ClinicOS** is a clinical workspace for outpatient clinics with two roles. The **front desk** registers patients, books and reschedules, checks patients in and marks no-shows. The **doctor** works a queue that is ordered by check-in, holds one patient in the room at a time, and turns rough notes into a structured record through an AI pipeline with full provenance tracking. The backend enforces both the queue and the role split; the UI only reflects them.

Doctors jot down unstructured notes during patient conversations. ClinicOS processes these observations through a self-healing LLM pipeline that extracts structured clinical categories (chief complaint, symptoms, relevant history, medications mentioned, and actionable plan), while identifying missing clinical categories. The clinician remains in full control: every structured element is editable, visually tracked by source, and explicitly verified before committing to the patient's longitudinal record.

> [!TIP]
> **Zero-cost local development**: You can run and test ClinicOS completely offline without an external LLM API key by setting `AI_PROVIDER=fake`.

---

## Consultation Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Doctor
    participant UI as Next.js Workspace
    participant API as Elysia Backend
    participant LLM as LLM via OpenRouter
    participant DB as PostgreSQL (Prisma 7)

    Note over Doctor,API: Front desk has checked the patient in (BOOKED → WAITING)
    Doctor->>UI: Start consultation for the next patient in the queue
    UI->>API: PATCH /appointments/:id { status: IN_CONSULTATION }
    Note over API: Refused with 409 if someone else is in the room or an earlier check-in is unfinished
    Doctor->>UI: Enter rough clinical notes
    Doctor->>UI: Trigger "Structure notes" (Ctrl+Enter)
    UI->>API: POST /ai/structure-consultation { rawNotes }
    API->>LLM: Pass prompt + raw notes (Deterministic JSON schema)
    alt Schema match
        LLM-->>API: Valid JSON draft
    else Schema validation failure
        API->>LLM: Self-healing repair pass with validation errors
        LLM-->>API: Corrected JSON draft
    end
    API-->>UI: Return StructuredNote { draft, model, latencyMs }
    UI->>Doctor: Render draft with Iris AI marks & missing info alerts
    Doctor->>UI: Review, edit fields, add prescriptions, modify plan
    Note over UI,Doctor: Edits flip item source from "AI" to "Doctor"
    Doctor->>UI: Save Consultation (Ctrl+S)
    UI->>API: POST /consultations (Idempotent clientRequestId)
    API->>DB: Persist rawNotes, aiDraft, finalNote, wasAiEdited, audit metadata
    API->>DB: Transition appointment to COMPLETED
    API-->>UI: 201 Created
    UI->>Doctor: Confirm commit & update longitudinal history
```

---

## Architecture

ClinicOS uses a decoupled full-stack architecture running on the **Bun** runtime.

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 Frontend                      │
│             (App Router · React 19 · Motion)                │
│                                                             │
│   Doctor:  Dashboard (/) · Patient Record (/patients/[id])  │
│            Consultation (/patients/[id]/consultation)       │
│   Front desk: /front-desk · /front-desk/book                │
│            /front-desk/patients/new · …/[id]/edit           │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
  Browser HTTP │ /api/* rewrite               │ Server-side fetch
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                      ElysiaJS Backend                       │
│           (Bun Runtime · TypeBox Route Guards)              │
│                                                             │
│  [ Auth / Roles ]        [ Clinical Routes ]     [ AI API ] │
│  Argon2id Passwords      Appointments, Patients,  Structuring│
│  httpOnly Cookie         Consultations, Staff     Summary   │
│  DOCTOR / RECEPTIONIST   Queue + room rules       (doctors) │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Prisma 7 + PG Driver    │ │   AI Provider Layer        │
│   PostgreSQL 16 Database     │ │  ├─ OpenRouterProvider     │
│   (emr & emr_test schemas)   │ │  │   (model = AI_MODEL)    │
│   Partial unique indexes for │ │  └─ FakeAiProvider (Mock)  │
│   one room / one slot        │ │                            │
└──────────────────────────────┘ └────────────────────────────┘
```

### Self-Healing AI Pipeline

1. **Strict Prompt Constraints**: The LLM acts strictly as a clinical formatter. Prompts forbid hallucinating facts, inferring diagnoses, or padding information.
2. **Missing Information Advisory**: If vital metrics (dosage, vitals, symptom duration) are absent from raw notes, the engine classifies them into an advisory `missingInformation` list rather than guessing values.
3. **Deterministic Generation**: Uses `responseMimeType: "application/json"`, temperature 0, and strict token limits.
4. **Two-Tier Validation Gate**:
   - `LooseNoteSchema`: Permissively extracts recognized keys and trims backtick wrappers or markdown fences.
   - `normalizeNote`: Coerces arrays, drops duplicate entries case-insensitively, and normalizes empty strings to `null`.
   - `StructuredNoteSchema`: Enforces the final strict contract.
5. **Self-Healing Repair Loop**: If the initial response violates schema constraints, the backend sends the invalid payload back to the model with the exact validation error for an immediate single-pass correction.
6. **Graceful Degradation**: If the AI service times out or errors, the interface transitions smoothly to manual entry without blocking consultation workflows.

---

## Key Features

- **Two roles, enforced server-side**: Every signed-in user carries a `DOCTOR` or `RECEPTIONIST` role. Consultations, patient history and every AI endpoint answer `403 FORBIDDEN` to the front desk; only a doctor can put a patient in the room or complete a visit; only the front desk can mark someone absent. The frontend redirects each role to its own home.
- **Ownership on top of roles**: Patient records are clinic-wide: any doctor can read any patient's history and run AI over it, because a covering doctor needs the record. Appointments and consultations have an owner. A doctor can only start, finish, reschedule or save a consultation against an appointment booked with them (`403`), and can only edit a consultation they wrote (`404`, so the record's existence is not revealed). The front desk works every doctor's schedule. Sign-in locks an email for 15 minutes after ten failed attempts (`429`).
- **Appointment states and queue rules**: `BOOKED → WAITING → IN_CONSULTATION → COMPLETED`, plus `NO_SHOW` and `CANCELLED`. A doctor can have one patient in the room, and a checked-in patient starts only when everyone checked in earlier is done. Both rules are enforced by the backend, the first one race-safely by a partial unique index, and surfaced in the UI as disabled actions with a reason.
- **Front desk workflow**: Register patients (one record per phone number; a match points to the existing patient), book and reschedule (past times and double-booked slots are refused), check in, mark absent, restore, cancel with confirmation.
- **Clinician-in-the-Loop Provenance**: Every field and list item maintains an explicit `source: "ai" | "doctor"` tag. AI-drafted items sit on a muted iris tint; editing one flips it to doctor styling ("Doctor edited"). The provenance is also announced to screen readers.
- **Draft safety**: Regenerating keeps the previous draft one click away. Saving with an empty structured note asks first, so a notes-only visit is a choice, not an accident. A same-tab reload restores the draft without a prompt.
- **Idempotent Consultations**: The consultation editor mints a unique `clientRequestId` per session. Network retries, double-clicks, or crash restores resolve idempotently to the same database record, including two identical requests arriving at once (the unique index decides, the loser is served the winner's row). The same key with different content is refused with `409`. AI provenance (`wasAiUsed`, model, latency) is derived from the attached draft, never taken from the client.
- **Resilient Unsaved-Changes Guard**: In-flight consultation notes mirror continuously to `sessionStorage`. Route changes trigger custom modal confirmations, and page unloads trigger browser guards. If a session expires or a tab crashes, drafting progress can be restored with a single click.
- **Voice dictation**: A **Record** button in the notes panel streams the doctor's speech to AssemblyAI straight from the browser and drops each finished sentence into the notes; the sentence still being recognised shows beneath the notes so it never overwrites typing. The backend only mints a short-lived token. Hidden entirely when no key is configured.
- **Longitudinal History Summarizer**: Synthesizes past visits into concise 2-4 sentence clinical summaries (`POST /ai/patient-summary`) strictly grounded in previously saved notes.
- **Cookie Session Authentication**: Lightweight, secure session management powered by `Bun.password` (Argon2id) and `httpOnly` lax cookies, completely free of external auth dependencies. One signed-in device per user: a new sign-in replaces the previous session, so two devices can never act on the same queue at once.
- **Single-Origin Proxy Architecture**: Next.js App Router proxies `/api/*` to the backend service. Upstream API keys remain protected on the server, avoiding cross-origin overhead during local development.

---

## Screens

| Screen | Route | Key Functionality |
|---|---|---|
| **Doctor dashboard** | `/` | Today's queue with status filters (Booked, Waiting, In consultation, Completed, plus Absent and Cancelled when present). The next checked-in patient's row is the only enabled Start; rows behind it are disabled with the reason. Booked and absent rows say the front desk marks arrival. Up-next card with allergies and conditions. |
| **Patient record** | `/patients/[id]` | Identity, allergies, conditions and medications mentioned in notes, then the clinical timeline with side-by-side AI draft comparison. The front desk sees identity, allergies, conditions and the patient's appointments instead; clinical notes are never sent to them. |
| **Consultation workspace** | `/patients/[id]/consultation` | Three columns: patient context, doctor notes, editable draft. The page takes the room on open and releases it on leave. Redirects to the record once the appointment is completed. |
| **Front desk** | `/front-desk` | The day's schedule with per-row Check in / Arrived / Restore (arrival is only ever recorded here or by a walk-in) and a More menu for Mark absent, Reschedule and Cancel. Register and Book actions, walk-in shortcut, patient directory. |
| **Book / Reschedule** | `/front-desk/book` | Patient, doctor (when more than one), native date and time, reason. Shows what the doctor already has that day; refuses past times and taken slots. |
| **Register / Edit patient** | `/front-desk/patients/new`, `/front-desk/patients/[id]/edit` | Demographics, allergies and conditions. A phone match points to the existing record. |
| **Sign-in** | `/sign-in` | One form for both roles; each lands on its own home. Honours `?next=` and recovers when a session expires mid-use. |

---

## Quickstart

### Prerequisites

- [Bun](https://bun.sh) (v1.4+)
- [Docker](https://www.docker.com) & Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/vivek1504/clinicOS
cd clinicOS
```

### 2. Start the Database

From the repository root:

```bash
cd backend
cp .env.example .env
bun install
bun run db:up
```

> [!NOTE]
> `bun run db:up` starts a PostgreSQL 16 container exposing port `5432` with two pre-configured databases: `emr` (development) and `emr_test` (test suite).

### 3. Initialize and Seed Database

```bash
# Run schema migrations
bun run db:migrate

# Seed the demo doctor and receptionist, patients, appointments, and consultation histories.
# Clears patients, appointments and consultations first; staff accounts and sessions are kept.
bun run db:seed
```

### 4. Start Backend API

```bash
bun run dev
```

The backend starts on `http://localhost:3001`.
Interactive Swagger documentation is available at `http://localhost:3001/swagger`.

### 5. Start Frontend Client

Open a new terminal window:

```bash
cd frontend
cp .env.example .env
bun install
bun run dev
```

The frontend will be running on `http://localhost:3000`.

### Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Doctor** | `vivek@gmail.com` | `pass123` |
| **Receptionist** | `recp@gmail.com` | `pass123` |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://emr:emr@localhost:5432/emr` |
| `TEST_DATABASE_URL` | PostgreSQL test database connection string | `postgresql://emr:emr@localhost:5432/emr_test` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `""` |
| `AI_PROVIDER` | Active AI provider (`openrouter` or `fake`) | `openrouter` |
| `AI_MODEL` | OpenRouter model identifier (any chat model, e.g. `openai/gpt-4o-mini`) | `openai/gpt-4o-mini` |
| `AI_TIMEOUT_MS` | Upstream AI request timeout in milliseconds | `20000` |
| `ASSEMBLYAI_API_KEY` | AssemblyAI key for voice dictation (optional; blank hides Record) | `""` |
| `STAFF_PASSWORD` | Password given to the two staff accounts when a deploy first creates them; existing passwords are never reset | `pass123` |
| `CLINIC_TZ` | Clinic timezone for "today", day ranges and slots; the process `TZ` is set from it at startup | `Asia/Kolkata` |
| `PORT` | API server port | `3001` |
| `CORS_ORIGIN` | Allowed cross-origin source | `http://localhost:3000` |

> [!IMPORTANT]
> If `OPENROUTER_API_KEY` is omitted while `AI_PROVIDER=openrouter`, all core patient and consultation services function normally. AI endpoints will return `503 AI_UNAVAILABLE` with clear actionable UI states. To run AI structuring offline, switch to `AI_PROVIDER=fake`.

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|---|---|---|
| `API_URL` | Upstream Elysia backend URL | `http://localhost:3001` |

---

## Project Structure

```
├── backend/
│   ├── docker/                 # Database initialization scripts
│   ├── prisma/
│   │   ├── schema.prisma       # User (doctor / receptionist), Patient, Appointment, Consultation, Session
│   │   ├── migrations/         # Incl. hand-written partial unique indexes (one room, one slot per doctor)
│   │   ├── seed.ts             # Clinical demo data; clears clinical tables first
│   │   ├── staff.ts            # The two demo accounts, shared by the seed and the deploy step
│   │   └── ensure-staff.ts     # Run on every deploy: upserts staff, touches nothing else
│   ├── src/
│   │   ├── ai/                 # OpenRouter provider, fake provider, prompt templates, normalizers
│   │   ├── lib/                # Prisma client singleton, domain errors, date utilities
│   │   ├── routes/             # REST endpoints (auth, appointments, patients, consultations, staff, ai)
│   │   ├── schemas/            # TypeBox validation schemas
│   │   ├── services/           # Domain logic, queue/room rules (queue.ts), AI orchestration
│   │   ├── auth.ts             # Session plugin and role guards
│   │   ├── app.ts              # Elysia application factory
│   │   └── index.ts            # Server entrypoint
│   ├── test/                   # Route, room/queue, reception, consultation and AI repair suites
│   └── vercel.json             # Build step: migrate, then ensure staff accounts
│
├── frontend/
│   ├── app/
│   │   ├── (app)/              # Authenticated routes: dashboard, patient, consultation, front-desk/
│   │   ├── (auth)/             # Authentication views (/sign-in)
│   │   └── globals.css         # Theme tokens, clinical color scales, and base typography
│   ├── components/
│   │   ├── consultation/       # Workspace editor, draft reducer, persistence hooks
│   │   ├── dashboard/          # Schedule, filters, appointment rows, up-next rail
│   │   ├── reception/          # Front desk queue, booking form, patient form
│   │   ├── layout/             # Top navigation, user menu, branding
│   │   ├── patient/            # Record cards, clinical timeline, AI reading aid
│   │   ├── shared/             # Status badge, provenance marks, empty/error states, SafeLink
│   │   └── ui/                 # Button, input, textarea, dialog, label, skeleton, spinner
│   ├── lib/                    # API client and DTOs, queue helper (visit.ts), role gate (role.ts), formatting
│   └── proxy.ts                # Redirects to /sign-in when no session cookie is present
```

---

## API Reference

Every endpoint except `/health` and `/auth/*` needs a session cookie. The **Who** column is enforced by the backend; the wrong role gets `403 FORBIDDEN`.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| `POST` | `/auth/sign-in` | anyone | Set the `httpOnly` session cookie; returns the user with their `role` |
| `GET` | `/auth/me` | signed in | Current user and role |
| `POST` | `/auth/sign-out` | signed in | Revoke session and expire cookie |
| `GET` | `/appointments?date=YYYY-MM-DD` | both | The day's schedule, with patient and doctor names |
| `GET` | `/appointments?patientId=…` | both | Every appointment for one patient, newest first |
| `POST` | `/appointments` | both | Book (`BOOKED`) or add a walk-in (`WAITING`); refuses past times and taken slots |
| `PATCH` | `/appointments/:id` | by transition | `{ status }` to move state, or `{ scheduledAt, reason }` to reschedule. `IN_CONSULTATION`, `COMPLETED` and stepping out are doctor-only; `NO_SHOW` is front-desk-only |
| `GET` | `/doctors` | both | Bookable doctors |
| `GET` | `/patients?q=` | both | Search by name or phone digits |
| `POST` | `/patients` | both | Register; `409` naming the existing record on a phone match |
| `GET` | `/patients/:id` | both | Demographics, allergies, conditions |
| `PATCH` | `/patients/:id` | both | Edit demographics, allergies, conditions |
| `GET` | `/patients/:id/consultations` | doctor | Clinical timeline |
| `POST` | `/consultations` | doctor | Save the note with an idempotency key; completes the linked appointment |
| `POST` | `/ai/structure-consultation` | doctor | Raw notes → structured JSON draft |
| `POST` | `/ai/patient-summary` | doctor | Short history summary, never stored |
| `GET` | `/ai/voice` | doctor | Whether voice dictation is configured |
| `POST` | `/ai/transcription-token` | doctor | Short-lived AssemblyAI streaming token |
| `GET` | `/health` | anyone | Service health probe |

Conflict codes worth handling in a client: `ALREADY_IN_CONSULTATION` (someone holds the room; details name them), `QUEUE_ORDER` (an earlier check-in is unfinished), `CONFLICT` (slot taken, duplicate patient, illegal transition).

---

## Testing

ClinicOS maintains automated test coverage across domain logic, the room and queue rules, role permissions, front desk flows, LLM normalization, schema repair loops, and frontend draft reducers.

### Backend Test Suite

Runs integration tests against the isolated `emr_test` database. Includes two simultaneous starts yielding exactly one 200 and one 409, no-show and check-in ordering, receptionist permissions, duplicate registration and double-booking:

```bash
cd backend
bun test
```

Type check:

```bash
bun run typecheck
```

### Frontend Test Suite

Runs unit tests covering normalization parity, reducer states (including previous-draft restore), the queue helper that decides who is blocked by whom, and error handling:

```bash
cd frontend
bun test
```

Lint and type validation:

```bash
bun run lint
bunx tsc --noEmit
```

---

## Deployment

Production runs on Vercel as two projects from the same repository, connected to GitHub. A push to `master` deploys both.

| Project | Root Directory | Notes |
|---|---|---|
| `frontend` | `frontend` | Next.js. Needs `API_URL` pointing at the backend's production URL. `instrumentation.ts` sets the process timezone from `CLINIC_TZ` (default Asia/Kolkata) so "today" is not the UTC day. |
| `backend` | `backend` | Bun runtime (`vercel.json` pins `bunVersion`). Needs `DATABASE_URL` (pooled), `DIRECT_URL` (direct, for migrations), `OPENROUTER_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `CORS_ORIGIN`, and `ASSEMBLYAI_API_KEY` if dictation should be on. `CLINIC_TZ` is optional and defaults to Asia/Kolkata. |

On production deploys only (`VERCEL_ENV=production`), the backend's build command runs `prisma migrate deploy` over `DIRECT_URL` and then `prisma/ensure-staff.ts`, which creates the two staff accounts if they are missing and otherwise leaves them alone, password included. It never touches patients, appointments or consultations. If a migration fails, the build fails and the previous deployment stays live.

> [!NOTE]
> Preview builds skip migrations and staff provisioning, so a branch can never migrate the production database. A preview that needs a schema change must run against its own database.
