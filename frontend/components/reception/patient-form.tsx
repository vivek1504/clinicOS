"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeLink } from "@/components/shared/safe-link";
import { ApiError } from "@/lib/api/client";
import { createPatient, updatePatient } from "@/lib/api/patients";
import type { Gender, PatientDto } from "@/lib/api/types";

const SELECT =
  "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-accent-500 focus-visible:ring-3 focus-visible:ring-accent-500/15";

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Registers a patient, or edits one when `existing` is given. A phone match warns before a second record is made. */
export function PatientForm({ existing }: { existing?: PatientDto }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [dob, setDob] = useState(existing?.dob ?? "");
  const [gender, setGender] = useState<Gender>(existing?.gender ?? "FEMALE");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [allergies, setAllergies] = useState(existing?.allergies.join(", ") ?? "");
  const [conditions, setConditions] = useState(existing?.conditions.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ patientId: string; name: string } | null>(null);

  const submit = async (e: React.FormEvent | null, allowDuplicate = false) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setDuplicate(null);
    const body = { name: name.trim(), dob, gender, phone: phone.trim(), allergies: splitList(allergies), conditions: splitList(conditions) };
    try {
      if (existing) {
        await updatePatient(existing.id, body);
        router.push(`/patients/${existing.id}`);
      } else {
        const created = await createPatient({ ...body, allowDuplicate });
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

  return (
    <form onSubmit={(e) => void submit(e)} className="panel grid gap-5 p-6">
      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" required maxLength={120} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" required max={new Date().toISOString().slice(0, 10)} value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gender">Gender</Label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={SELECT}>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" required inputMode="tel" autoComplete="off" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-0100" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="allergies">Known allergies</Label>
        <Input id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Penicillin, Latex" aria-describedby="list-hint" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="conditions">Known conditions</Label>
        <Input id="conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Asthma, Type 2 Diabetes" aria-describedby="list-hint" />
        <p id="list-hint" className="text-[12px] text-ink-3">Separate several with commas. Doctors add to these during consultations.</p>
      </div>

      {duplicate ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-wait-100 px-4 py-3 text-[13px] text-ink">
          <span>
            <span className="font-medium">{duplicate.name} is already registered with this phone number.</span>{" "}
            <span className="text-ink-2">Same person? Open their record instead.</span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" render={<SafeLink href={`/patients/${duplicate.patientId}`} />}>
              Open {duplicate.name.split(" ")[0]}&apos;s record
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void submit(null, true)} disabled={busy}>
              Register anyway
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-danger-100 px-3 py-2 text-[13px] font-medium text-danger-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" render={<SafeLink href={existing ? `/patients/${existing.id}` : "/front-desk"} />}>
          Back
        </Button>
        <Button type="submit" loading={busy} disabled={busy}>
          {existing ? "Save details" : "Register and book"}
        </Button>
      </div>
    </form>
  );
}
