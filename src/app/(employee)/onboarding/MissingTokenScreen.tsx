"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ESubsidiary } from "@/types/shared.types";
import { subsidiaryContent } from "@/config/subsidiaries";

export function MissingTokenScreen() {
  const content = subsidiaryContent[ESubsidiary.INDIA];
  const regionName = content.name.replace(/^NPT\s+/i, "");

  return (
    <div className="onboarding flex min-h-screen flex-col bg-white">
      <Navbar
        subsidiaryDisplayName={regionName}
        subsidiaryCode={ESubsidiary.INDIA}
        helpEmail="hr@example.com"
      />

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-7 shadow-sm">
          <p className="text-[11px] font-semibold tracking-[0.26em] text-slate-500">
            EMPLOYEE ONBOARDING
          </p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            Open your onboarding link
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            For security, onboarding can only be accessed from the invitation
            link sent to your email by HR.
          </p>

          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">
              Already submitted?
            </p>
            <p className="mt-1 text-sm text-slate-600">
              You can safely close this tab and wait for HR to contact you by
              email.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

