// src/config/subsidiaries.ts
import { ESubsidiary } from "@/types/shared.types";

type SubsidiaryContent = {
  name: string; // e.g. "NPT India"
  groupName: string; // e.g. "NPT Group"
  description: string; // short paragraph
  needs: string[]; // bullet list
};

export const subsidiaryContent: Record<ESubsidiary, SubsidiaryContent> = {
  [ESubsidiary.INDIA]: {
    name: "NPT India",
    groupName: "NPT Group",
    description:
      "NPT Group is a global logistics and technology company focused on reliability, service excellence, and innovation. Our India division supports operations, customer service, dispatch, software development, and corporate services.",
    needs: [
      "Government ID (Aadhaar, PAN, or equivalent)",
      "Bank account details and IFSC code",
      "Emergency contact information",
    ],
  },

  [ESubsidiary.CANADA]: {
    name: "NPT Canada",
    groupName: "NPT Group",
    description:
      "NPT Canada supports regional logistics, transport operations, compliance, and fleet management for the North American region.",
    needs: [
      "Government ID (Driver's Licence, PR Card, or Work Permit)",
      "SIN (securely encrypted and never stored in plain text)",
      "Bank account and transit number",
      "Emergency contact details",
    ],
  },

  [ESubsidiary.USA]: {
    name: "NPT USA",
    groupName: "NPT Group",
    description:
      "NPT USA manages domestic logistics, operations, and driver onboarding across the United States.",
    needs: [
      "Government ID (State ID, Driver's Licence, or Passport)",
      "SSN (encrypted at rest)",
      "Bank routing and account number",
      "Emergency contact details",
    ],
  },
};
