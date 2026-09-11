"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeLink } from "@/components/shared/safe-link";
import { ApiError } from "@/lib/api/client";
import { createPatient, updatePatient } from "@/lib/api/patients";
import type { Gender, PatientDto } from "@/lib/api/types";
import { fieldErrors, focusFirstError, patientSchema, type FieldErrors } from "@/lib/forms";

const SELECT =
  "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-accent-500 focus-visible:ring-3 focus-visible:ring-accent-500/15 aria-invalid:border-danger-700";

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** What the form holds while it is being filled in; the modal keeps it across steps so Back loses nothing. */
export interface PatientDraft {
  name: string;
  dob: string;
  gender: Gender | "";
  phone: string;
  allergies: string;
  conditions: string;
}

/** Registers a patient, or edits one when `existing` is given. Validated with zod before anything is sent. */
export function PatientForm({
  existing,
  embedded = false,
  onBack,
  onDone,
  initial,
  onDraftChange,
  submitLabel,
}: {
  existing?: PatientDto;
  /** Inside a modal: no card chrome, a Back button the caller controls, and the caller receives the created patient. */
  embedded?: boolean;
  onBack?: () => void;
  onDone?: (saved: PatientDto) => void;
  /** Values to start from and a callback with every change, so a parent can restore the form later. */
  initial?: Partial<PatientDraft>;
  onDraftChange?: (draft: PatientDraft) => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initial?.name ?? existing?.name ?? "");
  const [dob, setDob] = useState(initial?.dob ?? existing?.dob ?? "");
  // Nothing preselected: a wrong default is worse than a blank one on a clinical record.
  const [gender, setGender] = useState<Gender | "">(initial?.gender ?? existing?.gender ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? existing?.phone ?? "");
  const [allergies, setAllergies] = useState(initial?.allergies ?? existing?.allergies.join(", ") ?? "");
  const [conditions, setConditions] = useState(initial?.conditions ?? existing?.conditions.join(", ") ?? "");
  useEffect(() => {
    onDraftChange?.({ name, dob, gender, phone, allergies, conditions });
  }, [name, dob, gender, phone, allergies, conditions, onDraftChange]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ patientId: string; name: string } | null>(null);

  /** Clears a field's error as soon as the doctor edits it; the message has done its job. */
  const clear = (key: string) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = fieldErrors(patientSchema, { name: name.trim(), dob, gender, phone: phone.trim(), allergies: splitList(allergies), conditions: splitList(conditions) });
    if (invalid) {
      setErrors(invalid);
      focusFirstError(formRef.current, invalid);
      return;
    }
    const body = { name: name.trim(), dob, gender: gender as Gender, phone: phone.trim(), allergies: splitList(allergies), conditions: splitList(conditions) };
    setBusy(true);
    setError(null);
    setDuplicate(null);
    try {
      if (existing) {
        const updated = await updatePatient(existing.id, body);
        if (onDone) {
          onDone(updated);
          return;
        }
        router.push(`/patients/${existing.id}`);
      } else {
        const created = await createPatient(body);
        if (onDone) {
          onDone(created);
          return;
        }
        router.push(`/front-desk/book?patientId=${encodeURIComponent(created.id)}`);
      }
      router.refresh();
    } catch (err) {
      const dup = err instanceof ApiError && err.code === "CONFLICT" ? (err.details as { patientId?: string; name?: string } | undefined) : undefined;
      if (dup?.patientId && dup.name) setDuplicate({ patientId: dup.patientId, name: dup.name });
      else setError(err instanceof ApiError ? err.message : "Could not save the patient");
      setBusy(false);
    }
  };

  const describe = (key: string) => (errors[key] ? `${key}-error` : undefined);

  return (
    <form ref={formRef} noValidate onSubmit={(e) => void submit(e)} className={embedded ? "grid gap-5" : "panel grid gap-5 p-6"}>
      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" maxLength={120} autoComplete="off" value={name} aria-invalid={!!errors.name || undefined} aria-describedby={describe("name")} onChange={(e) => { setName(e.target.value); clear("name"); }} />
        <FieldError id="name-error" message={errors.name} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={dob} aria-invalid={!!errors.dob || undefined} aria-describedby={describe("dob")} onChange={(e) => { setDob(e.target.value); clear("dob"); }} />
          <FieldError id="dob-error" message={errors.dob} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gender">Gender</Label>
          <select id="gender" value={gender} aria-invalid={!!errors.gender || undefined} aria-describedby={describe("gender")} onChange={(e) => { setGender(e.target.value as Gender | ""); clear("gender"); }} className={`${SELECT} ${gender ? "" : "text-ink-4"}`}>
            <option value="">Select gender</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
          <FieldError id="gender-error" message={errors.gender} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" inputMode="numeric" autoComplete="off" maxLength={10} value={phone} placeholder="9876543210" aria-invalid={!!errors.phone || undefined} aria-describedby={describe("phone")} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); clear("phone"); }} />
        <FieldError id="phone-error" message={errors.phone} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="allergies">Known allergies</Label>
        <Input id="allergies" value={allergies} placeholder="Penicillin, Latex" aria-invalid={!!errors.allergies || undefined} aria-describedby={errors.allergies ? "allergies-error" : "list-hint"} onChange={(e) => { setAllergies(e.target.value); clear("allergies"); }} />
        <FieldError id="allergies-error" message={errors.allergies} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="conditions">Known conditions</Label>
        <Input id="conditions" value={conditions} placeholder="Asthma, Type 2 Diabetes" aria-invalid={!!errors.conditions || undefined} aria-describedby={errors.conditions ? "conditions-error" : "list-hint"} onChange={(e) => { setConditions(e.target.value); clear("conditions"); }} />
        <FieldError id="conditions-error" message={errors.conditions} />
        <p id="list-hint" className="text-[12px] text-ink-3">Separate several with commas. Doctors add to these during consultations.</p>
      </div>

      {duplicate ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-wait-100 px-4 py-3 text-[13px] text-ink">
          <span>
            <span className="font-medium">{duplicate.name} is already registered with this phone number.</span>{" "}
            <span className="text-ink-2">Open their record, or change the number if this is someone else.</span>
          </span>
          <Button size="sm" render={<SafeLink href={`/patients/${duplicate.patientId}`} />}>
            Open {duplicate.name.split(" ")[0]}&apos;s record
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-danger-100 px-3 py-2 text-[13px] font-medium text-danger-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
        ) : embedded ? null : (
          <Button type="button" variant="ghost" render={<SafeLink href={existing ? `/patients/${existing.id}` : "/front-desk"} />}>
            Back
          </Button>
        )}
        <Button type="submit" loading={busy} disabled={busy}>
          {submitLabel ?? (existing ? (embedded ? "Save and continue" : "Save details") : "Register and book")}
        </Button>
      </div>
    </form>
  );
}
