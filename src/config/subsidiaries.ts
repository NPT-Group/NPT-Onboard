// src/config/subsidiaries.ts
import { ESubsidiary } from "@/types/shared.types";

type SubsidiaryContent = {
  name: string; // e.g. "Onboardly India"
  groupName: string; // e.g. "Onboardly Group"
  description: string; // short paragraph
  needs: string[]; // bullet list
};

export const subsidiaryContent: Record<ESubsidiary, SubsidiaryContent> = {
  [ESubsidiary.INDIA]: {
    name: "Onboardly India",
    groupName: "Onboardly ",
    description:
      "We help organizations welcome employees the right way from their first interaction. Our onboarding platform removes friction from paperwork, compliance, and setup. So teams can focus on people, not processes.",
    needs: [
      "Government ID (Aadhaar, PAN, or equivalent)",
      "Bank account details and IFSC code",
      "Emergency contact information",
    ],
  },

  [ESubsidiary.CANADA]: {
    name: "Onboardly Canada",
    groupName: "Onboardly",
    description:
      "We help organizations welcome employees the right way from their first interaction. Our onboarding platform removes friction from paperwork, compliance, and setup. So teams can focus on people, not processes.",
    needs: [
      "Government ID (Driver's Licence, PR Card, or Work Permit)",
      "SIN (securely encrypted and never stored in plain text)",
      "Bank account and transit number",
      "Emergency contact details",
    ],
  },

  [ESubsidiary.USA]: {
    name: "Onboardly USA",
    groupName: "Onboardly Group",
    description:
      "We help organizations welcome employees the right way from their first interaction. Our onboarding platform removes friction from paperwork, compliance, and setup. So teams can focus on people, not processes.",
    needs: [
      "Government ID (State ID, Driver's Licence, or Passport)",
      "SSN (encrypted at rest)",
      "Bank routing and account number",
      "Emergency contact details",
    ],
  },
};
