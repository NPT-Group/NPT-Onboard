"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  Ban,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileText,
  ScrollText,
} from "lucide-react";

import ProfileDropdown from "@/components/shared/ProfileDropdown";
import { ThemeModeSwitcher } from "@/components/dashboard/theme/ThemeModeSwitcher";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  Icon: any;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  // Sidebar is fixed/open on desktop (xl+). Below xl, it becomes collapsible.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const sp = useSearchParams();
  const subsidiary = sp.get("subsidiary");
  const onboardingIdFromQuery = sp.get("onboardingId");
  const terminatedHref = subsidiary
    ? `/dashboard/terminated?subsidiary=${encodeURIComponent(subsidiary)}`
    : "/dashboard/terminated";

  // Detect onboarding detail routes to switch sidebar to "Application" mode.
  const onboardingMatch = pathname.match(
    /^\/dashboard\/onboardings\/([^/]+)(?:\/(audit-logs))?$/,
  );
  const onboardingId = onboardingMatch?.[1] ?? null;
  // Keep "Application mode" even when navigating to global pages (like Settings)
  // by preserving context via `?onboardingId=` in the URL.
  const contextOnboardingId = onboardingId ?? onboardingIdFromQuery;
  const isOnboardingArea = Boolean(contextOnboardingId);

  const groups: NavGroup[] = isOnboardingArea
    ? [
        {
          label: "NAVIGATION",
          items: [
            { href: "/dashboard", label: "Home", Icon: Home },
            { href: "/dashboard/terminated", label: "Terminated", Icon: Ban },
          ],
        },
        {
          label: "APPLICATION",
          items: [
            {
              href: `/dashboard/onboardings/${contextOnboardingId}`,
              label: "Onboarding details",
              Icon: FileText,
            },
            {
              href: `/dashboard/onboardings/${contextOnboardingId}/audit-logs`,
              label: "Audit logs",
              Icon: ScrollText,
            },
          ],
        },
        {
          label: "SYSTEM",
          items: [
            { href: "/dashboard/settings", label: "Settings", Icon: Settings },
          ],
        },
      ]
    : [
        {
          label: "NAVIGATION",
          items: [
            { href: "/dashboard", label: "Home", Icon: Home },
            { href: "/dashboard/terminated", label: "Terminated", Icon: Ban },
          ],
        },
        {
          label: "SYSTEM",
          items: [
            { href: "/dashboard/settings", label: "Settings", Icon: Settings },
          ],
        },
      ];

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/dashboard/terminated")
      return pathname === "/dashboard/terminated";
    if (href === "/dashboard/settings")
      return pathname === "/dashboard/settings";

    // Mutually-exclusive active state between details and audit logs.
    if (
      contextOnboardingId &&
      href === `/dashboard/onboardings/${contextOnboardingId}`
    ) {
      return pathname === `/dashboard/onboardings/${contextOnboardingId}`;
    }
    if (
      contextOnboardingId &&
      href === `/dashboard/onboardings/${contextOnboardingId}/audit-logs`
    ) {
      return (
        pathname === `/dashboard/onboardings/${contextOnboardingId}/audit-logs`
      );
    }

    return false;
  }

  const sidebarNav = (
    <div className="px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="mb-5 last:mb-0">
          <div className="mb-3 px-2 text-[11px] font-semibold tracking-[0.26em] text-[var(--dash-muted)]">
            {group.label}
          </div>
          <nav className="space-y-1">
            {group.items.map(({ href, label, Icon }) => {
              const computedHref =
                href === "/dashboard/terminated"
                  ? terminatedHref
                  : href === "/dashboard/settings" && contextOnboardingId
                    ? `/dashboard/settings?onboardingId=${encodeURIComponent(contextOnboardingId)}`
                    : href;
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={computedHref}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    "cursor-pointer",
                    active
                      ? "bg-[var(--dash-red-soft)] text-[var(--dash-text)]"
                      : "text-[var(--dash-muted)] hover:bg-[var(--dash-surface-2)]",
                  )}
                  title={label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 border-b border-[var(--dash-border)] last:hidden" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--dash-bg)] text-[var(--dash-text)]">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-[var(--dash-border)] bg-[var(--dash-surface)]/90 backdrop-blur xl:pl-72">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center gap-3">
            {/* Collapsible sidebar trigger (below xl only) */}
            <motion.button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className={cn(
                "inline-flex xl:hidden items-center justify-center rounded-full border shadow-sm",
                "h-9 w-9",
                "border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-muted)]",
                "hover:bg-[var(--dash-surface-2)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-red-soft)]",
              )}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </motion.button>

            {/* Desktop logo */}
            <div className="flex items-center gap-3">
              <Image
                src="/assets/logos/Logo.png"
                alt="Onboardly"
                width={0}
                height={0}
                sizes="100vw"
                className="h-auto w-[98px] object-contain"
                priority
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <ThemeModeSwitcher />
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Desktop sidebar pinned to far-left wall (xl+) */}
      <aside
        className={cn(
          "hidden xl:block fixed left-0 top-16 bottom-0 border-r w-72",
          "border-[var(--dash-border)] bg-[var(--dash-surface)]",
        )}
      >
        {sidebarNav}
      </aside>

      {/* Main layout (content stays in container, sidebar does not) */}
      <div className="w-full xl:pl-72">
        <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
          <main>{children}</main>
        </div>
      </div>

      {/* Collapsible sidebar overlay (below xl only) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl bg-[var(--dash-surface)] border-r border-[var(--dash-border)]"
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--dash-border)]">
                <div className="text-[11px] font-semibold tracking-[0.26em] text-[var(--dash-muted)]">
                  NAVIGATION
                </div>
                <button
                  type="button"
                  className="rounded-full p-2 text-[var(--dash-muted)] hover:bg-[var(--dash-surface-2)]"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close sidebar"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>
              <div className="h-[calc(100%-4rem)] overflow-auto">
                {sidebarNav}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
