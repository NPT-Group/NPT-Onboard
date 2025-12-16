"use client";

import { Button } from "@/components/ui/button";
import { ESubsidiary } from "@/types/shared.types";
import { subsidiaryContent } from "@/config/subsidiaries";
import { SubsidiaryWhatYouNeed } from "@/features/onboarding/invite/SubsidiaryWhatYouNeed";

type WelcomeHeroProps = {
  onContinue: () => void;
  subsidiary: ESubsidiary;
};

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  onContinue,
  subsidiary,
}) => {
  const content = subsidiaryContent[subsidiary];

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-5 py-8 sm:px-8 sm:py-10">
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        {/* Top label: Subsidiary and page identifier */}
        <p className="text-[11px] font-semibold tracking-[0.26em] text-slate-500">
          {content.name.toUpperCase()} • EMPLOYEE ONBOARDING
        </p>

        {/* Main heading with brand pill */}
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.4rem] md:text-[2.8rem] md:leading-tight">
          <span className="inline-flex flex-wrap items-center justify-center gap-2">
            <span>Welcome to</span>
            <span className="hero-brand-pill align-baseline">
              {content.groupName}
            </span>
          </span>
        </h1>

        {/* Subheading: subsidiary-specific description */}
        <p className="mt-4 max-w-2xl text-sm text-slate-700 sm:text-[0.95rem]">
          {content.description}
        </p>

        {/* Information card: Required documents and information */}
        <SubsidiaryWhatYouNeed subsidiary={subsidiary} />

        {/* Primary call-to-action button */}
        <div className="mt-9 flex justify-center">
          <Button
            className="rounded-full px-10 py-2.5 text-sm font-semibold bg-slate-950 hover:bg-black text-white shadow-lg shadow-slate-900/25 cursor-pointer"
            onClick={onContinue}
          >
            Continue
          </Button>
        </div>
      </div>
    </section>
  );
};
