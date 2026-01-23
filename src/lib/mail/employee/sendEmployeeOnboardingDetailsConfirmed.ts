import { ESubsidiary } from "@/types/shared.types";
import { sendMailAppOnly } from "@/lib/mail/mailer";
import { escapeHtml } from "@/lib/mail/utils";
import { NPT_HR_EMAIL } from "@/config/env";
import { buildEmployeeEmailLayout } from "@/lib/mail/templates/buildEmployeeEmailLayout";

export type SendEmployeeOnboardingDetailsConfirmedParams = {
  to: string;
  firstName: string;
  lastName: string;
  subsidiary: ESubsidiary;
};

export async function sendEmployeeOnboardingDetailsConfirmed(params: SendEmployeeOnboardingDetailsConfirmedParams): Promise<void> {
  const { to, firstName, lastName, subsidiary } = params;

  const fullName = `${firstName} ${lastName}`.trim();
  const escapedName = escapeHtml(fullName || "there");
  const escapedSubsidiary = escapeHtml(subsidiary);

  const subject = "NPT Employee Onboarding – Details Confirmed";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${escapedName},</p>

    <p style="margin:0 0 12px 0;">
      This is a quick update that your onboarding details for
      <strong>NPT (${escapedSubsidiary})</strong> have been
      <strong>confirmed</strong> by our HR team.
    </p>

    <p style="margin:0 0 16px 0;">
      HR will contact you shortly with the next steps to complete your onboarding,
      including any required contracts and policy acknowledgements.
    </p>

    <p style="margin:0 0 4px 0;">Thank you,</p>
    <p style="margin:0 0 24px 0;">NPT HR</p>
  `;

  const html = buildEmployeeEmailLayout({
    subject,
    heading: "Your details are confirmed",
    subtitle: `NPT (${escapedSubsidiary})`,
    bodyHtml,
    footerContactEmail: NPT_HR_EMAIL,
  });

  await sendMailAppOnly({
    from: NPT_HR_EMAIL,
    to: [to],
    subject,
    html,
  });
}
