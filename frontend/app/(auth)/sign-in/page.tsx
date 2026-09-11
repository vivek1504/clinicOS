import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/layout/app-shell";
import { IntelligenceField } from "@/components/layout/intelligence-field";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <section className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="relative z-10 flex items-center gap-2.5 [&_span:last-child]:text-white [&_span:last-child_span]:text-white/50 [&>span:first-child]:bg-white [&>span:first-child]:text-ink [&>span:first-child_span]:bg-ink">
          <Wordmark large />
        </div>
        <IntelligenceField className="absolute inset-0 h-full w-full" />
        <div className="relative z-10 max-w-sm">
          <p className="display text-[40px] leading-[1.05]">
            Notes in, <span className="italic text-accent-300">structure</span> out.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-white/60">
            A consultation workspace that structures what you write, marks what it drafted, and never saves without you.
          </p>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <Wordmark large />
        </div>
        <div className="w-full max-w-[380px]">
          <Suspense>
            <SignInForm />
          </Suspense>
        </div>
        <p className="mt-10 text-xs text-ink-3">For clinical staff only. Access is monitored and logged.</p>
      </section>
    </main>
  );
}
