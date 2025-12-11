import { ESubsidiary } from "@/types/shared.types";
import { sendMailAppOnly } from "@/lib/mail/mailer";
import { escapeHtml } from "@/lib/mail/utils";
import { NPT_HR_EMAIL } from "@/config/env";
import { buildEmployeeEmailLayout } from "@/lib/mail/templates/buildEmployeeEmailLayout";

export type SendEmployeeOnboardingModificationRequestParams = {
  to: string;
  firstName: string;
  lastName: string;
  subsidiary: ESubsidiary;
  baseUrl: string;
  /** Fresh raw invite token for modification flow */
  inviteToken: string;
  /** HR message explaining what needs to be changed */
  message: string;
};

export async function sendEmployeeOnboardingModificationRequest(params: SendEmployeeOnboardingModificationRequestParams): Promise<void> {
  const { to, firstName, lastName, subsidiary, baseUrl, inviteToken, message } = params;

  if (!inviteToken) {
    throw new Error("inviteToken is required for onboarding modification emails");
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const escapedName = escapeHtml(fullName || "there");
  const escapedSubsidiary = escapeHtml(subsidiary);

  const link = `${baseUrl}/onboarding?token=${encodeURIComponent(inviteToken)}`;
  const escapedLink = escapeHtml(link);

  const escapedMessage = escapeHtml(message || "").replace(/\r?\n/g, "<br/>");

  const subject = "NPT Employee Onboarding – Update Required";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${escapedName},</p>
    <p style="margin:0 0 12px 0;">
      Thank you for submitting your onboarding information for
      <strong>NPT (${escapedSubsidiary})</strong>. After reviewing your details,
      HR has requested that you make some updates.
    </p>
    <p style="margin:0 0 8px 0; font-weight:500;">Requested changes</p>
    <div style="margin:0 0 16px 0; padding:12px 14px; border-radius:8px; background-color:#f9fafb; border:1px solid #e5e7eb; font-size:14px; color:#374151;">
      ${escapedMessage || "Please review your onboarding form and update the highlighted sections."}
    </div>
    <p style="margin:0 0 12px 0;">
      To update your onboarding form, please use the secure link below.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0 24px 0;">
      <tr>
        <td>
          <a href="${escapedLink}"
            style="
              display:inline-block;
              padding:10px 18px;
              font-size:14px;
              font-weight:500;
              text-decoration:none;
              border-radius:9999px;
              background-color:#2563eb;
              color:#ffffff;
            ">
            Resume and update form
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 12px 0; font-size:13px; color:#6b7280;">
      For security reasons, this link is time-limited. If it expires, please contact HR to receive a new link.
    </p>
    <p style="margin:0 0 4px 0;">Thank you,</p>
    <p style="margin:0 0 24px 0;">NPT HR</p>
  `;

  const html = buildEmployeeEmailLayout({
    subject,
    heading: "Updates requested for your onboarding",
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
