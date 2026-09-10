<!-- prettier-ignore -->
<div align="center">

# ClinicOS

**High-performance, clinician-focused Electronic Medical Records (EMR) workspace with ambient AI consultation structuring.**

[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun%20v1.4+-black?style=flat-square&logo=bun)](https://bun.sh)
[![Framework: Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Backend: ElysiaJS](https://img.shields.io/badge/Backend-ElysiaJS-violet?style=flat-square&logo=elysia)](https://elysiajs.com)
[![Database: PostgreSQL 16](https://img.shields.io/badge/Database-PostgreSQL%2016-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![ORM: Prisma 7](https://img.shields.io/badge/ORM-Prisma%207-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io)
[![Model: Gemini 2.5 Flash](https://img.shields.io/badge/AI-Google%20Gemini%202.5%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev)
[![Language: TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

<br />

[Overview](#overview) • [Consultation Workflow](#consultation-workflow) • [Architecture](#architecture) • [Key Features](#key-features) • [Screens](#screens) • [Quickstart](#quickstart) • [Environment Variables](#environment-variables) • [API Reference](#api-reference) • [Testing](#testing)

</div>

---

## Overview

**ClinicOS** is a clinical workspace engineered for real-time outpatient encounters. It bridges rough clinician notes and structured electronic health records through an AI pipeline with full provenance tracking.

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
    participant LLM as Gemini 2.5 Flash
    participant DB as PostgreSQL (Prisma 7)

    Doctor->>UI: Select scheduled patient & enter rough clinical notes
    Doctor->>UI: Trigger "Structure with AI" (Ctrl+Enter)
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
│   Dashboard (/)  ·  Patient Record (/patients/[id])         │
│   Consultation Workspace (/patients/[id]/consultation)      │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
  Browser HTTP │ /api/* rewrite               │ Server-side fetch
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                      ElysiaJS Backend                       │
│           (Bun Runtime · TypeBox Route Guards)              │
│                                                             │
│  [ Auth / Session ]      [ Clinical Routes ]     [ AI API ] │
│  Argon2id Passwords      Appointments, Patients,  Structuring│
│  httpOnly Cookie         Consultations            Summary   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Prisma 7 + PG Driver    │ │   AI Provider Layer        │
│   PostgreSQL 16 Database     │ │  ├─ GeminiProvider         │
│   (emr & emr_test schemas)   │ │  │   (gemini-2.5-flash)    │
│   Consultation History Audit │ │  └─ FakeAiProvider (Mock)  │
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

- **Clinician-in-the-Loop Provenance**: Every field and list item maintains an explicit `source: "ai" | "doctor"` tag. The interface visually marks AI-drafted items in muted iris and updates them to doctor styling ("Edited by doctor") upon modification.
- **Idempotent Consultations**: The consultation editor mints a unique `clientRequestId` per session. Network retries, double-clicks, or crash restores resolve idempotently to the same database record.
- **Resilient Unsaved-Changes Guard**: In-flight consultation notes mirror continuously to `sessionStorage`. Route changes trigger custom modal confirmations, and page unloads trigger browser guards. If a session expires or a tab crashes, drafting progress can be restored with a single click.
- **Longitudinal History Summarizer**: Synthesizes past visits into concise 2-4 sentence clinical summaries (`POST /ai/patient-summary`) strictly grounded in previously saved notes.
- **Cookie Session Authentication**: Lightweight, secure session management powered by `Bun.password` (Argon2id) and `httpOnly` lax cookies, completely free of external auth dependencies.
- **Single-Origin Proxy Architecture**: Next.js App Router proxies `/api/*` to the backend service. Upstream API keys remain protected on the server, avoiding cross-origin overhead during local development.

---

## Screens

| Screen | Route | Key Functionality |
|---|---|---|
| **Appointment Schedule** | `/` | Queue of today's appointments with status filters (Waiting, In Consultation, Completed). Direct deep links to start or continue consultations. |
| **Patient Dossier** | `/patients/[id]` | Demographic records, flagged allergies, chronic conditions, medication timeline, and expandable visit history with side-by-side AI draft comparison. |
| **Consultation Workspace** | `/patients/[id]/consultation` | Three-column workspace: Patient context rail, rough note input editor, and live structured note review board with missing information indicators. |
| **Doctor Sign-In** | `/sign-in` | Session authentication supporting redirect parameters (`?next=`) and in-place recovery when credentials expire mid-session. |

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

# Seed demo doctor, patients, appointments, and consultation histories
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

| Field | Value |
|---|---|
| **Doctor Email** | `mehta@clinicos.local` |
| **Password** | `clinicos` |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://emr:emr@localhost:5432/emr` |
| `TEST_DATABASE_URL` | PostgreSQL test database connection string | `postgresql://emr:emr@localhost:5432/emr_test` |
| `GEMINI_API_KEY` | Google Gemini API key | `""` |
| `AI_PROVIDER` | Active AI provider (`gemini` or `fake`) | `gemini` |
| `AI_MODEL` | Google Gemini model identifier | `gemini-2.5-flash` |
| `AI_TIMEOUT_MS` | Upstream AI request timeout in milliseconds | `20000` |
| `PORT` | API server port | `3001` |
| `CORS_ORIGIN` | Allowed cross-origin source | `http://localhost:3000` |

> [!IMPORTANT]
> If `GEMINI_API_KEY` is omitted while `AI_PROVIDER=gemini`, all core patient and consultation services function normally. AI endpoints will return `503 AI_UNAVAILABLE` with clear actionable UI states. To run AI structuring offline, switch to `AI_PROVIDER=fake`.

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
│   │   ├── schema.prisma       # Database schema (Doctor, Patient, Consultation, Appointment)
│   │   └── seed.ts             # Clinical demo data seed script
│   ├── src/
│   │   ├── ai/                 # Gemini provider, fake provider, prompt templates, normalizers
│   │   ├── lib/                # Prisma client singleton, domain errors, date utilities
│   │   ├── routes/             # REST endpoints (auth, appointments, patients, consultations, ai)
│   │   ├── schemas/            # TypeBox validation schemas
│   │   ├── services/           # Domain business logic & AI orchestration
│   │   ├── app.ts              # Elysia application factory
│   │   └── index.ts            # Server entrypoint
│   └── test/                   # End-to-end integration and AI repair test suites
│
├── frontend/
│   ├── app/
│   │   ├── (app)/              # Authenticated clinical workspace layouts and routes
│   │   ├── (auth)/             # Authentication views (/sign-in)
│   │   └── globals.css         # Theme tokens, clinical color scales, and base typography
│   ├── components/
│   │   ├── consultation/       # Workspace editor, draft reducer, persistence hooks
│   │   ├── dashboard/          # Schedule timeline, filter controls, patient summary cards
│   │   ├── layout/             # Top navigation, doctor menu, branding
│   │   ├── patient/            # Medical record cards, allergy badges, timeline views
│   │   └── ui/                 # Accessible primitives (buttons, inputs, dialogs)
│   ├── lib/                    # API client, error mappings, formatting helpers
│   └── proxy.ts                # Route authentication session guard
│
└── assets/
    └── logo.svg                # ClinicOS vector brand asset
```

---

## API Reference

All clinical and AI endpoints require an authenticated doctor session cookie.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/sign-in` | Authenticate clinician and set `httpOnly` session cookie |
| `GET` | `/auth/me` | Fetch active clinician session profile |
| `POST` | `/auth/sign-out` | Revoke session and expire cookie |
| `GET` | `/appointments?date=YYYY-MM-DD` | Retrieve scheduled visits for a target date |
| `GET` | `/patients/:id` | Fetch patient dossier, allergy flags, and consultation timeline |
| `POST` | `/consultations` | Save finalized clinical note with idempotency key |
| `POST` | `/ai/structure-consultation` | Parse raw doctor notes into structured clinical JSON |
| `POST` | `/ai/patient-summary` | Generate a longitudinal clinical history summary |
| `GET` | `/health` | Service health probe |

---

## Testing

ClinicOS maintains automated test coverage across domain logic, LLM normalization, schema repair loops, and frontend draft reducers.

### Backend Test Suite

Runs integration tests against the isolated `emr_test` database:

```bash
cd backend
bun test
```

Type check:

```bash
bun run typecheck
```

### Frontend Test Suite

Runs unit tests covering normalization parity, reducer states, and error handling:

```bash
cd frontend
bun test
```

Lint and type validation:

```bash
bun run lint
bunx tsc --noEmit
```
