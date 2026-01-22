"use client";

import { Laptop, Moon, Sun, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useDashboardTheme,
  type DashboardThemeMode,
} from "@/components/dashboard/theme/DashboardThemeProvider";

export default function SettingsPage() {
  const { mode, setMode } = useDashboardTheme();

  const options: Array<{
    mode: DashboardThemeMode;
    title: string;
    description: string;
    Icon: any;
  }> = [
    {
      mode: "light",
      title: "Light",
      description: "Clean and bright",
      Icon: Sun,
    },
    {
      mode: "dark",
      title: "Dark",
      description: "Easy on the eyes",
      Icon: Moon,
    },
    {
      mode: "system",
      title: "System",
      description: "Follows your OS",
      Icon: Laptop,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            "bg-[var(--dash-red-soft)] text-[var(--dash-red)]",
          )}
        >
          <SettingsIcon className="h-5 w-5" />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[var(--dash-muted)]">
            Manage your application preferences
          </p>
        </div>
      </header>

      {/* About */}
      <section
        className={cn(
          "rounded-3xl border p-6 shadow-[var(--dash-shadow)]",
          "border-[var(--dash-border)] bg-[var(--dash-surface)]",
        )}
      >
        <h2 className="text-lg font-semibold">About Onboardly</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--dash-muted)]">
          Onboardly is the secure onboarding platform for Employee subsidiaries,
          designed to streamline employee onboarding with a modern, accessible
          interface.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--dash-muted)]">
          Built with Next.js, TypeScript, Tailwind CSS and robust validation to
          ensure production-grade reliability.
        </p>
        <p className="mt-4 text-xs font-medium text-[var(--dash-muted)]">
          Version 0.1.0
        </p>
      </section>

      {/* Appearance */}
      <section
        className={cn(
          "rounded-3xl border p-6 shadow-[var(--dash-shadow)]",
          "border-[var(--dash-border)] bg-[var(--dash-surface)]",
        )}
      >
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-2 text-sm text-[var(--dash-muted)]">
          Choose your preferred theme for the application interface.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {options.map(({ mode: m, title, description, Icon }) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border p-4 text-left transition",
                  "border-[var(--dash-border)] bg-[var(--dash-surface-2)]/40",
                  "hover:bg-[var(--dash-surface-2)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
                  active &&
                    "bg-[var(--dash-red-soft)] border-[var(--dash-red-soft)]",
                )}
                aria-pressed={active}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl border",
                    "border-[var(--dash-border)] bg-[var(--dash-surface)]",
                    active &&
                      "border-[var(--dash-red-soft)] bg-[var(--dash-surface)]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active
                        ? "text-[var(--dash-red)]"
                        : "text-[var(--dash-muted)]",
                    )}
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="mt-0.5 text-xs text-[var(--dash-muted)]">
                    {description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
