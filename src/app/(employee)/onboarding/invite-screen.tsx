"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ESubsidiary } from "@/types/shared.types";
import { subsidiaryContent } from "@/config/subsidiaries";
import { OtpModal } from "./invite/OtpModal";
import { WelcomeHero } from "./invite/WelcomeHero";

type Props = {
  inviteToken: string;
};

export function OnboardingInviteScreen({ inviteToken }: Props) {
  // Which subsidiary this invite belongs to (resolved after first OTP request).
  const [subsidiary, setSubsidiary] = useState<ESubsidiary | null>(null);

  // View state: whether OTP modal is open.
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);

  // For v1, invites are India-only, so default to India until resolved.
  const resolvedSubsidiary = subsidiary ?? ESubsidiary.INDIA;
  const content = subsidiaryContent[resolvedSubsidiary];
  const regionName = content.name.replace(/^NPT\s+/i, "");

  function openOtpModal() {
    setIsOtpModalOpen(true);
  }

  function closeOtpModal() {
    setIsOtpModalOpen(false);
  }

  return (
    <div className="onboarding flex min-h-screen flex-col bg-white">
      {/* Navigation Bar */}
      <Navbar
        subsidiaryDisplayName={regionName}
        subsidiaryCode={resolvedSubsidiary}
        helpEmail="hr@example.com"
      />

      {/* Main hero content */}
      <main className="flex flex-1 items-stretch justify-center px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <WelcomeHero
          onContinue={openOtpModal}
          subsidiary={resolvedSubsidiary}
        />
      </main>

      {/* Footer */}
      <Footer />

      {/* OTP Verification Modal */}
      <OtpModal
        open={isOtpModalOpen}
        onClose={closeOtpModal}
        inviteToken={inviteToken}
        onSubsidiaryResolved={setSubsidiary}
      />
    </div>
  );
}
