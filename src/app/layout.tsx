import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/ui/SessionWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
      `http://localhost:${process.env.PORT ?? 3000}`,
  ),
  applicationName: "Onboardly",
  title: {
    default: "Onboardly",
    template: "%s · Onboardly",
  },
  description:
    "Secure employee onboarding platform. Complete your onboarding, upload required documents, and track your submission status.",
  icons: {
    icon: "/assets/logos/Logo.png",
    shortcut: "/assets/logos/Logo.png",
    apple: "/assets/logos/Logo.png",
  },
  openGraph: {
    type: "website",
    title: "Onboardly",
    description: "Secure employee onboarding platform",
    siteName: "Onboardly",
    images: [
      {
        url: "/assets/logos/Logo.png",
        width: 512,
        height: 512,
        alt: "Onboardly",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Onboardly",
    description: "Secure employee onboarding platform.",
    images: ["/assets/logos/Logo.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
  colorScheme: "light dark",
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
