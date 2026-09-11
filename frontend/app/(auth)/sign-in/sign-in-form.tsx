"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRightIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/client";
import { FieldError } from "@/components/ui/field-error";
import { fieldErrors, focusFirstError, signInSchema, type FieldErrors } from "@/lib/forms";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const expired = params.get("expired") === "1";
  const next = params.get("next");
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const invalid = fieldErrors(signInSchema, { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
    if (invalid) {
      setErrors(invalid);
      focusFirstError(formRef.current, invalid);
      return;
    }
    setErrors({});
    setLoading(true);
    setError(null);
    try {
      await signIn(String(form.get("email")), String(form.get("password")));
      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(
        isApiError(err, "UNAUTHORIZED")
          ? "Incorrect email or password."
          : isApiError(err, "NETWORK")
            ? "Could not reach the clinical server."
            : "Sign-in failed. Try again.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="display text-[36px] text-ink">Welcome back</h1>
      <p className="mt-2 text-[14px] text-ink-3">
        {expired ? "Your session ended. Sign in again to continue." : "Sign in with your work email to open today's consultations."}
      </p>

      <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-8 grid gap-5" aria-describedby={error ? "sign-in-error" : undefined}>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-sm">
            Work email
          </Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@clinic.com" className="h-10" aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? "email-error" : undefined} onChange={() => setErrors((x) => (x.email ? { ...x, email: undefined } : x))} />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password" className="text-sm">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={error || errors.password ? true : undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
              onChange={() => setErrors((x) => (x.password ? { ...x, password: undefined } : x))}
              className="h-10 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-ink-3 transition-colors hover:text-ink"
            >
              {showPassword ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}
            </button>
          </div>
          <FieldError id="password-error" message={errors.password} />
        </div>

        {error ? (
          <p id="sign-in-error" role="alert" className="rounded-md bg-danger-100 px-3 py-2 text-[13px] font-medium text-danger-700">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          Sign in
          <ArrowRightIcon />
        </Button>
      </form>

      <p className="mt-8 text-center text-[13px] text-ink-3">No account yet? Ask your practice administrator for access.</p>
    </div>
  );
}
