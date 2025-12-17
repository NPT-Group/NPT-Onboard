import { DashboardShell } from "@/components/dashboard/layout/DashboardShell";
import { DashboardThemeProvider } from "@/components/dashboard/theme/DashboardThemeProvider";
import { cookies } from "next/headers";
import Script from "next/script";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const rawMode = cookieStore.get("npt.dashboard.theme.mode")?.value;
  const initialMode =
    rawMode === "light" || rawMode === "dark" || rawMode === "system"
      ? rawMode
      : undefined;

  return (
    <>
      {/* Prevent white flash on reload by applying theme before paint. */}
      <Script
        id="dash-theme-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{if(!location.pathname.startsWith('/dashboard'))return;var k='npt.dashboard.theme.mode';var m=localStorage.getItem(k)||'system';var t=(m==='light'||m==='dark')?m:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.dataset.dashTheme=t;document.cookie='npt.dashboard.theme.mode='+encodeURIComponent(m)+';path=/;max-age=31536000;samesite=lax';}catch(e){}})();",
        }}
      />

      <DashboardThemeProvider initialMode={initialMode}>
      <DashboardShell>{children}</DashboardShell>
      </DashboardThemeProvider>
    </>
  );
}

