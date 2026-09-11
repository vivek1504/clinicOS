# ClinicOS Frontend — Next.js 16 (App Router)

Clinic workspace with two roles. The front desk runs the day; the doctor works the queue and writes notes with AI help:

```
Front desk:  Register → Book → Check in ─┐            ┌─ Mark absent / Reschedule / Cancel
                                          ▼            │
Doctor:      Today's queue → Start (next in line) → Rough notes → AI structures them
             → Doctor reviews and edits → Save → Patient history
```

Which home a user lands on is decided by their role from `/auth/me`; the backend enforces the same split on every request, so the UI only reflects it.

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
| `/` (doctor) | Today's queue with a one-line summary under the greeting. Filters: Booked, Waiting, In consultation, Completed, plus No show and Cancelled when present. Only the next checked-in patient's row has an enabled **Start**; rows behind it are disabled with a tooltip naming who is first. Booked and absent rows say that the front desk marks arrival. An up-next card shows allergies, conditions and age. Row click opens the patient. |
| `/patients/[id]` | Identity (demographics collapsed), allergies, conditions, medications mentioned in notes, then the clinical timeline with an AI reading aid and **Compare with AI draft**. Once today's appointment is completed the header shows "Consultation recorded today" instead of Start. The front desk sees identity, allergies, conditions and the patient's appointments; no notes, no AI. |
| `/patients/[id]/consultation` | Three columns: patient context with a link to the full record, **Doctor notes**, **Draft**. **Structure notes** → honest processing state (label and elapsed time) → editable draft. AI-drafted rows sit on an iris tint; editing one flips it to doctor styling ("Doctor edited"). **Structure again** keeps the previous draft one click away. Saving with an empty structured note asks first. The page takes the room on open (a 409 shows who holds it) and releases it on leave. Redirects to the record if the appointment is already completed. |
| `/front-desk` | The receptionist's home. Schedule rows with **Check in** / **Arrived** / **Restore** visible and a **More** menu for Mark absent, Reschedule and Cancel (with confirmation). Date navigation, walk-in shortcut, Register and Book actions, patient directory. |
| `/front-desk/book` | Book or reschedule: patient, doctor (only when several), native date and time, reason, walk-in checkbox. Lists what the doctor already has that day; refuses past times and taken slots with a visible message. |
| `/front-desk/patients/new`, `/front-desk/patients/[id]/edit` | Register or edit a patient. A phone match shows the existing patient with **Open their record**; one record per phone number. Registering flows straight into booking. |
| `/sign-in` | One form for both roles; honours `?next=` and shows a notice when redirected for an expired session. Demo accounts: doctor `vivek@gmail.com`, receptionist `recp@gmail.com`, password `pass123`. |

## Design system

- Tokens live in `app/globals.css`: warm neutral canvas, one clinical accent (deep green) for the doctor's actions, one reserved hue (muted iris) for anything the model produced, amber/grey status, a single danger colour for allergies. Secondary text (`ink-3`) meets WCAG AA on both backgrounds; the tertiary grey (`ink-4`) is for placeholders and icons only, never text.
- Type: Instrument Serif for display headings, Geist for UI, Geist Mono for times and identifiers. Labels never go below 11 px; clinical eyebrow labels are 12 px.
- Motion via `motion`: staggered list reveal, AI processing → draft reveal, list item add/remove, save confirmation. Everything respects `prefers-reduced-motion`. The global `:focus-visible` ring is visible on every control.

## Layout

```
components/
  layout/        app shell (top bar, wordmark), user menu with role caption
  dashboard/     overview line, schedule (search / date / filter), appointment rows, up-next rail, patient directory
  reception/     front desk queue with row actions, booking form, patient form
  patient/       record cards, clinical timeline, AI reading aid
  consultation/  workspace orchestrator, context rail, notes panel, AI panel, structured draft, list fields,
                 save bar, saved state, draft model + reducer (+ tests), persistence + guard hooks
  shared/        status badge, AI mark and per-row AI dot, empty/error states, SafeLink, note view
  ui/            button, input, textarea, dialog, label, skeleton, spinner
lib/
  api/           apiFetch, DTO types, per-resource calls (auth, appointments, patients, consultations, ai)
  visit.ts       today's visit for a patient and who blocks whom, mirroring the backend queue rule (+ tests)
  role.ts        server-side role gate for a page; the wrong role is sent to its own home
```

## Authentication

- The backend sets an `httpOnly` `session` cookie. Browser calls go through the `/api/*` rewrite, so the cookie travels automatically; Server Components forward it by hand (`lib/api/server.ts` registers `next/headers` cookies with `apiFetch`).
- `proxy.ts` redirects any app route without a session cookie to `/sign-in?next=…` (presence check only). The app layout calls `/auth/me` and redirects to `/sign-in?expired=1` when the cookie is stale.
- Roles: `/` sends a receptionist to `/front-desk`; the front desk pages and the consultation editor send a doctor or receptionist to their own home via `lib/role.ts`. These are conveniences; the backend refuses the wrong role with `403` regardless.
- A `401` from a browser call triggers a full navigation to sign-in; an in-progress consultation is already mirrored to `sessionStorage`, so the editor offers to restore it after signing back in.
- Sign-out lives in the top bar and respects the unsaved-changes guard.

## Design choices worth knowing

- **Source tracking is the data model.** Every field and list item carries `source: "ai" | "doctor"`. The row tint, the "n items to review" counter and the `wasAiEdited` flag all derive from it; nothing is tracked separately. The AI tag appears once in the panel title; each AI row has a dot that also announces "AI draft" to screen readers.
- **The queue is decided once, on the server.** `lib/visit.ts` mirrors the backend's rule so buttons can be disabled with a reason before a click, but every start still goes through `PATCH /appointments/:id`, and a `409` is shown as a banner naming who is in the room or ahead in the queue.
- **Regenerate is not destructive.** The replaced draft, including edits, stays restorable until save. Saving with an empty structured note asks first.
- **AI failure is a normal state.** Timeout, rate limit, bad output and unavailability each get specific copy plus **Retry** and **Continue without AI**. The form is always usable without a draft. Generation is cancellable; cancel aborts the upstream request too.
- **Idempotent save.** A `clientRequestId` is minted once per editor session and sent with the consultation. Double-clicks, retries after a network blip, and even a restore-after-crash resolve to the same row.
- **Unsaved-changes guard.** `beforeunload` for tab close; `SafeLink` and a guarded router show an in-app confirmation dialog (native `<dialog>`) for navigation. In-progress notes are also mirrored to `sessionStorage`; a recent same-tab snapshot is restored on reload without asking, an older one is offered with **Restore draft**.
- **No client cache for reads.** Dashboard and profile are Server Components with `cache: "no-store"` and Suspense boundaries. Freshness beats speed for clinical data.
- **Keyboard.** `Ctrl/Cmd+Enter` in the notes box generates, `Ctrl/Cmd+S` saves, `Enter` adds a list item, `Backspace` on an empty add-box removes the last item.

## Trade-offs

- DTO types are hand-mirrored from the backend's TypeBox schemas in `lib/api/types.ts`. Eden treaty would remove that duplication if the two packages shared a workspace.
- Allergies and conditions are shown beside the editor, but medications are not cross-checked against allergies automatically.
- "Today" is decided by the backend's clock; the frontend never sends a date.
- The browser back button is not intercepted while editing; the `beforeunload` prompt and link guard cover the common cases.
- No polling. A booking or check-in made at the front desk shows on the doctor's dashboard on their next navigation, not live.
- On phones the row status badge is dropped and each row keeps one short labeled action; the front desk's rare actions sit behind the More menu.

## Tests

`bun test` covers the pure parts that decide what gets saved and who may start: the editor reducer (including previous-draft restore), the draft model (normalization parity with the backend, `isEdited`), notes validation, the queue helper in `lib/visit.ts`, and the AI error copy map.
