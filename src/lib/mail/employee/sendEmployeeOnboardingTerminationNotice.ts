import { ESubsidiary } from "@/types/shared.types";
import { ETerminationType } from "@/types/onboarding.types";
import { sendMailAppOnly } from "@/lib/mail/mailer";
import { escapeHtml } from "@/lib/mail/utils";
import { NPT_HR_EMAIL } from "@/config/env";
import { buildEmployeeEmailLayout } from "@/lib/mail/templates/buildEmployeeEmailLayout";

export type SendEmployeeOnboardingTerminationNoticeParams = {
  to: string;
  firstName: string;
  lastName: string;
  subsidiary: ESubsidiary;
  baseUrl: string;
  terminationType: ETerminationType;
  terminationReason?: string;
};

export async function sendEmployeeOnboardingTerminationNotice(params: SendEmployeeOnboardingTerminationNoticeParams): Promise<void> {
  const { to, firstName, lastName, subsidiary, baseUrl, terminationType, terminationReason } = params;

  const fullName = `${firstName} ${lastName}`.trim();
  const escapedName = escapeHtml(fullName || "there");
  const escapedSubsidiary = escapeHtml(subsidiary);
  const escapedBaseUrl = escapeHtml(baseUrl);
  const escapedTerminationType = escapeHtml(terminationType);
  const escapedReason = terminationReason ? escapeHtml(terminationReason).replace(/\r?\n/g, "<br/>") : undefined;

  const subject = "NPT Employee Onboarding – Status Update";

  const reasonBlock = escapedReason
    ? `
      <p style="margin:0 0 8px 0; font-weight:500;">Additional details</p>
      <div style="margin:0 0 16px 0; padding:12px 14px; border-radius:8px; background-color:#f9fafb; border:1px solid #e5e7eb; font-size:14px; color:#374151;">
        ${escapedReason}
      </div>
    `
    : "";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${escapedName},</p>
    <p style="margin:0 0 12px 0;">
      This is to inform you that your employee onboarding for
      <strong>NPT (${escapedSubsidiary})</strong> has been marked as
      <strong>${escapedTerminationType}</strong>.
    </p>
    ${reasonBlock}
    <p style="margin:0 0 16px 0;">
      If you have any questions or believe this status is in error, please contact HR.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0 24px 0;">
      <tr>
        <td>
          <a href="${escapedBaseUrl}"
            style="
              display:inline-block;
              padding:10px 18px;
              font-size:14px;
              font-weight:500;
              text-decoration:none;
              border-radius:9999px;
              background-color:#6b7280;
              color:#ffffff;
            ">
            Visit NPT site
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 4px 0;">Thank you,</p>
    <p style="margin:0 0 24px 0;">NPT HR</p>
  `;

  const html = buildEmployeeEmailLayout({
    subject,
    heading: "Update on your onboarding status",
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
