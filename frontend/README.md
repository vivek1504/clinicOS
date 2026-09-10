# ClinicOS Frontend — Next.js 16 (App Router)

Doctor-facing clinical workspace for the AI-assisted consultation loop:

```
Today's appointments → Patient profile → New consultation → Rough notes
→ AI structures them → Doctor reviews and edits → Save → Patient history
```

The backend (`../backend`) must be running on port `3001`. See its README for `db:up`, `db:migrate`, `db:seed`.

## Run

```bash
cp .env.example .env     # API_URL=http://localhost:3001
bun install
bun run dev              # http://localhost:3000
```

Other scripts: `bun run build`, `bun run start`, `bun run lint`, `bun test`, `bunx tsc --noEmit`.

## How it talks to the API

- Server Components call the backend directly using `API_URL`.
- The browser calls `/api/*`, which `next.config.ts` rewrites to the backend. One origin, no CORS setup in dev, and the LLM key never leaves the Elysia process.
- Every non-2xx response becomes an `ApiError` carrying the backend's `{ code, message }`, so the UI branches on codes rather than status text.

## Screens

| Route | What it does |
| --- | --- |
| `/` | Today's appointments. Skeleton while loading, empty state, inline error with Retry. Row click opens the patient; **Start** / **Continue** jumps straight to a linked consultation. |
| `/patients/[id]` | Card-based record: identity card with personal information, medications mentioned in notes (first/last noted), diagnoses & conditions, allergies, then a chronological clinical timeline. Expand a visit for the structured note; **Compare with AI draft** puts the generated draft and the saved note side by side with the doctor's changes marked. |
| `/patients/[id]/consultation` | Three-column workspace: patient context rail, **Doctor notes**, **AI structured note**. Generate → staged processing state → editable draft. AI-drafted items carry the iris `AI` mark; editing one flips it to doctor styling with "Edited by doctor". `missingInformation` is an advisory list, never note content. Save shows an in-place confirmation and marks the linked appointment completed. |
| `/sign-in` | Signs in against `POST /auth/sign-in`; honours `?next=` and shows a notice when redirected for an expired session. Demo account: `mehta@clinicos.local` / `clinicos`. |

## Design system

- Tokens live in `app/globals.css`: warm neutral canvas, one clinical accent (deep green) for the doctor's actions, one reserved hue (muted iris) for anything the model produced, amber/grey status, a single danger colour for allergies.
- Type: Instrument Serif for display headings, Geist for UI, Geist Mono for times and identifiers.
- Motion via `motion`: staggered list reveal, AI processing → draft reveal, list item add/remove, count-up figures, save confirmation. Everything respects `prefers-reduced-motion`.

## Layout

```
components/
  layout/        app shell (top bar, wordmark)
  dashboard/     clinic overview figures, schedule (search / date / filter), appointment rows
  patient/       identity strip, clinical timeline
  consultation/  workspace orchestrator, notes panel, AI panel, structured draft, list fields,
                 save bar, saved state, draft model + reducer (+ tests), persistence + guard hooks
  shared/        status badge, AI/doctor source marks, empty/error states, SafeLink, note view
  ui/            button, input, textarea, dialog, skeleton, spinner, checkbox, label
```

## Authentication

- The backend sets an `httpOnly` `session` cookie. Browser calls go through the `/api/*` rewrite, so the cookie travels automatically; Server Components forward it by hand (`lib/api/server.ts` registers `next/headers` cookies with `apiFetch`).
- `proxy.ts` redirects any app route without a session cookie to `/sign-in?next=…` (presence check only). The app layout calls `/auth/me` and redirects to `/sign-in?expired=1` when the cookie is stale.
- A `401` from a browser call triggers a full navigation to sign-in; an in-progress consultation is already mirrored to `sessionStorage`, so the editor offers to restore it after signing back in.
- Sign-out lives in the top bar and respects the unsaved-changes guard.

## Design choices worth knowing

- **Source tracking is the data model.** Every field and list item carries `source: "ai" | "doctor"`. The badges, the "n AI drafts unreviewed" counter and the `wasAiEdited` flag all derive from it; nothing is tracked separately.
- **AI failure is a normal state.** Timeout, rate limit, bad output and unavailability each get specific copy plus **Retry** and **Continue without AI**. The form is always usable without a draft. Generation is cancellable; cancel aborts the upstream request too.
- **Idempotent save.** A `clientRequestId` is minted once per editor session and sent with the consultation. Double-clicks, retries after a network blip, and even a restore-after-crash resolve to the same row.
- **Unsaved-changes guard.** `beforeunload` for tab close; `SafeLink` and a guarded router show an in-app confirmation dialog (native `<dialog>`) for navigation. In-progress notes are also mirrored to `sessionStorage`, and the editor offers to restore them after a reload or crash.
- **No client cache for reads.** Dashboard and profile are Server Components with `cache: "no-store"` and Suspense boundaries. Freshness beats speed for clinical data.
- **Keyboard.** `Ctrl/Cmd+Enter` in the notes box generates, `Ctrl/Cmd+S` saves, `Enter` adds a list item, `Backspace` on an empty add-box removes the last item.

## Trade-offs

- DTO types are hand-mirrored from the backend's TypeBox schemas in `lib/api/types.ts`. Eden treaty would remove that duplication if the two packages shared a workspace.
- Allergies and conditions are shown beside the editor, but medications are not cross-checked against allergies automatically.
- "Today" is decided by the backend's clock; the frontend never sends a date.
- The browser back button is not intercepted while editing; the `beforeunload` prompt and link guard cover the common cases.

## Tests

`bun test` covers the pure parts that decide what gets saved: the editor reducer, the draft model (normalization parity with the backend, `isEdited`), notes validation and the AI error copy map.
