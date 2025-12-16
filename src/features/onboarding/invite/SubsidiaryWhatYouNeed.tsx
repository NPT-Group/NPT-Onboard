"use client";

import { ESubsidiary } from "@/types/shared.types";
import { subsidiaryContent } from "@/config/subsidiaries";

type SubsidiaryWhatYouNeedProps = {
  subsidiary: ESubsidiary;
};

export const SubsidiaryWhatYouNeed: React.FC<SubsidiaryWhatYouNeedProps> = ({
  subsidiary,
}) => {
  const content = subsidiaryContent[subsidiary];
  const needs = content.needs ?? [];

  return (
    <div className="mt-9 w-full">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-100 bg-white/95 p-6 text-left shadow-[0_12px_40px_rgba(15,23,42,0.10)]">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
          WHAT YOU&apos;LL NEED
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-800">
          {needs.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
