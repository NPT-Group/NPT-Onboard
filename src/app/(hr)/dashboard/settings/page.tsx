"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Moon,
  Sun,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useDashboardTheme,
  type DashboardThemeMode,
} from "@/components/dashboard/theme/DashboardThemeProvider";
import { ApiError, postJson } from "@/lib/api/client";

type SaveAdminCredentialsResponse = {
  adminUser: {
    email: string;
    name: string;
    passwordUpdatedAt?: string | null;
  };
};

export default function SettingsPage() {
  const { mode, setMode } = useDashboardTheme();
  const { data: session, status } = useSession();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsSuccess, setCredentialsSuccess] = useState<string | null>(null);
  const sessionEmail = session?.user?.email ?? "";
  const sessionName = session?.user?.name ?? "";

  const options: Array<{
    mode: DashboardThemeMode;
    title: string;
    description: string;
    Icon: any;
  }> = [
    { mode: "light", title: "Light", description: "Clean and bright", Icon: Sun },
    { mode: "dark", title: "Dark", description: "Easy on the eyes", Icon: Moon },
    { mode: "system", title: "System", description: "Follows your OS", Icon: Laptop },
  ];

  useEffect(() => {
    if (sessionEmail) setAdminEmail(sessionEmail);
    if (sessionName) setAdminName(sessionName);
  }, [sessionEmail, sessionName]);

  async function handleSaveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCredentialsError(null);
    setCredentialsSuccess(null);

    if (adminPassword.length < 12) {
      setCredentialsError("Password must be at least 12 characters long.");
      return;
    }

    if (adminPassword !== confirmPassword) {
      setCredentialsError("Passwords do not match.");
      return;
    }

    setSavingCredentials(true);
    try {
      const result = await postJson<
        { email: string; name: string; password: string },
        SaveAdminCredentialsResponse
      >("/api/v1/admin/admin-users/credentials", {
        email: adminEmail,
        name: adminName,
        password: adminPassword,
      });

      setCredentialsSuccess(`Credentials saved for ${result.adminUser.email}.`);
      setAdminPassword("");
      setConfirmPassword("");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Unable to save credentials. Please try again.";
      setCredentialsError(message);
    } finally {
      setSavingCredentials(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            "bg-[var(--dash-red-soft)] text-[var(--dash-red)]"
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
          "border-[var(--dash-border)] bg-[var(--dash-surface)]"
        )}
      >
        <h2 className="text-lg font-semibold">About NPT Onboard</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--dash-muted)]">
          NPT Onboard is the secure onboarding platform for NPT subsidiaries,
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

      {/* HR Credentials */}
      <section
        className={cn(
          "rounded-3xl border p-6 shadow-[var(--dash-shadow)]",
          "border-[var(--dash-border)] bg-[var(--dash-surface)]"
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              "bg-[var(--dash-red-soft)] text-[var(--dash-red)]"
            )}
          >
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">HR Email and Password Login</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--dash-muted)]">
              Create or update the password login for your own account. The
              email comes from your current signed-in session and cannot be
              changed here.
            </p>
          </div>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSaveCredentials}>
          <label className="block">
            <span className="text-sm font-medium">HR email</span>
            <input
              type="email"
              value={adminEmail}
              autoComplete="email"
              readOnly
              required
              className={cn(
                "mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition",
                "border-[var(--dash-border)] bg-[var(--dash-surface-2)] text-[var(--dash-muted)]",
                "cursor-not-allowed"
              )}
            />
            <span className="mt-1 block text-xs text-[var(--dash-muted)]">
              Only this signed-in account can create or update its password.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Display name</span>
            <input
              type="text"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              autoComplete="name"
              required
              className={cn(
                "mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition",
                "border-[var(--dash-border)] bg-[var(--dash-surface-2)] text-[var(--dash-text)]",
                "focus:border-[var(--dash-red)] focus:ring-2 focus:ring-[var(--dash-red-soft)]"
              )}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">New password</span>
            <div className="relative mt-1">
              <input
                type={showAdminPassword ? "text" : "password"}
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
                className={cn(
                  "w-full rounded-xl border px-4 py-2.5 pr-11 text-sm outline-none transition",
                  "border-[var(--dash-border)] bg-[var(--dash-surface-2)] text-[var(--dash-text)]",
                  "focus:border-[var(--dash-red)] focus:ring-2 focus:ring-[var(--dash-red-soft)]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword((value) => !value)}
                className="absolute inset-y-0 right-3 flex items-center text-[var(--dash-muted)] transition hover:text-[var(--dash-text)]"
                aria-label={showAdminPassword ? "Hide new password" : "Show new password"}
              >
                {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className="mt-1 block text-xs text-[var(--dash-muted)]">
              Use at least 12 characters.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Confirm password</span>
            <div className="relative mt-1">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
                className={cn(
                  "w-full rounded-xl border px-4 py-2.5 pr-11 text-sm outline-none transition",
                  "border-[var(--dash-border)] bg-[var(--dash-surface-2)] text-[var(--dash-text)]",
                  "focus:border-[var(--dash-red)] focus:ring-2 focus:ring-[var(--dash-red-soft)]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute inset-y-0 right-3 flex items-center text-[var(--dash-muted)] transition hover:text-[var(--dash-text)]"
                aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className="md:col-span-2">
            {credentialsError && (
              <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {credentialsError}
              </p>
            )}
            {credentialsSuccess && (
              <p className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {credentialsSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={savingCredentials || status !== "authenticated" || !adminEmail}
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition",
                "bg-[var(--dash-red)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {savingCredentials ? "Saving..." : "Save HR credentials"}
            </button>
          </div>
        </form>
      </section>

      {/* Appearance */}
      <section
        className={cn(
          "rounded-3xl border p-6 shadow-[var(--dash-shadow)]",
          "border-[var(--dash-border)] bg-[var(--dash-surface)]"
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
                    "bg-[var(--dash-red-soft)] border-[var(--dash-red-soft)]"
                )}
                aria-pressed={active}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl border",
                    "border-[var(--dash-border)] bg-[var(--dash-surface)]",
                    active &&
                      "border-[var(--dash-red-soft)] bg-[var(--dash-surface)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-[var(--dash-red)]" : "text-[var(--dash-muted)]"
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

