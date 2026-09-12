import { SafeLink } from "@/components/shared/safe-link";
import type { DoctorDto } from "@/lib/api/auth";
import { formatLongDate } from "@/lib/format";
import { DoctorMenu } from "./doctor-menu";

export function AppShell({ doctor, children }: { doctor: DoctorDto; children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent-700 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      <header className="topbar sticky top-0 z-30">
        <div className="mx-auto flex h-[64px] w-full max-w-[1920px] items-center justify-between px-5 sm:px-8">
          <SafeLink href="/" className="group flex items-center gap-2.5 rounded-sm text-ink">
            <Wordmark />
          </SafeLink>

          <div className="flex items-center gap-4 text-[14px]">
            <p className="hidden text-ink-3 sm:block" suppressHydrationWarning>
              {formatLongDate(new Date())}
            </p>
            <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
            <DoctorMenu doctor={doctor} />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col px-5 pt-8 pb-16 sm:px-8">
        {children}
      </main>

      <footer id="site-footer" className="border-t border-line/80">
        <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-1 px-5 py-4 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>ClinicOS · Clinical use only</p>
          <p>AI drafts are reviewed by the clinician before any note is saved.</p>
        </div>
      </footer>
    </>
  );
}

export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`relative inline-flex ${large ? "size-8 rounded-lg" : "size-7 rounded-md"} items-center justify-center bg-ink text-white`}
      >
        <span className={`absolute ${large ? "h-3.5 w-[3px]" : "h-3 w-0.5"} rounded-full bg-white`} />
        <span className={`absolute ${large ? "h-[3px] w-3.5" : "h-0.5 w-3"} rounded-full bg-white`} />
        <span className={`absolute ${large ? "size-2" : "size-1.5"} rounded-full bg-accent-300 translate-x-[35%] -translate-y-[35%]`} />
      </span>
      <span className={`${large ? "text-xl" : "text-[16px]"} font-semibold tracking-[-0.02em]`}>
        Clinic<span className="font-normal text-ink-3">OS</span>
      </span>
    </>
  );
}
