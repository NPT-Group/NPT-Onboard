import { EOnboardingMethod } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import { sendMailAppOnly, type GraphAttachment } from "@/lib/mail/mailer";
import { escapeHtml } from "@/lib/mail/utils";
import { NPT_HR_EMAIL } from "@/config/env";
import { buildEmployeeEmailLayout } from "@/lib/mail/templates/buildEmployeeEmailLayout";

export type SendEmployeeOnboardingInvitationParams = {
  to: string;
  firstName: string;
  lastName: string;
  method: EOnboardingMethod;
  subsidiary: ESubsidiary;
  baseUrl: string;
  /** Raw invite token for DIGITAL onboarding */
  inviteToken?: string;
  /** Manual PDF attachment (blank form) for MANUAL onboarding */
  manualFormAttachment?: GraphAttachment;
};

export async function sendEmployeeOnboardingInvitation(params: SendEmployeeOnboardingInvitationParams): Promise<void> {
  const { to, firstName, lastName, method, subsidiary, baseUrl, inviteToken, manualFormAttachment } = params;

  const fullName = `${firstName} ${lastName}`.trim();
  const escapedName = escapeHtml(fullName || "there");
  const escapedSubsidiary = escapeHtml(subsidiary);

  let subject: string;
  let html: string;
  const attachments: GraphAttachment[] = [];

  if (method === EOnboardingMethod.DIGITAL) {
    if (!inviteToken) {
      throw new Error("inviteToken is required for digital onboarding emails");
    }

    const link = `${baseUrl}/onboarding?token=${encodeURIComponent(inviteToken)}`;
    const escapedLink = escapeHtml(link);

    subject = "NPT Employee Onboarding – Complete Your Details";

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Hi ${escapedName},</p>
      <p style="margin:0 0 12px 0;">
        You have been invited to securely complete your employee onboarding for
        <strong>NPT (${escapedSubsidiary})</strong>.
      </p>
      <p style="margin:0 0 16px 0;">
        Please use the button below to access your onboarding form, verify your email,
        and provide the required information and documents.
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
              Start your onboarding
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 12px 0; font-size:13px; color:#6b7280;">
        For security reasons, this link is time-limited. If it expires, please contact HR to receive a new invitation.
      </p>
      <p style="margin:0 0 4px 0;">Thank you,</p>
      <p style="margin:0 0 24px 0;">NPT HR</p>
    `;

    html = buildEmployeeEmailLayout({
      subject,
      heading: "You're invited to complete your onboarding",
      subtitle: `NPT (${escapedSubsidiary})`,
      bodyHtml,
      footerContactEmail: NPT_HR_EMAIL,
    });
  } else {
    // MANUAL flow
    if (!manualFormAttachment) {
      throw new Error("manualFormAttachment is required for manual onboarding emails");
    }

    attachments.push(manualFormAttachment);

    subject = "NPT Employee Onboarding – Manual Form Attached";

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Hi ${escapedName},</p>
      <p style="margin:0 0 12px 0;">
        Please find attached the employee onboarding form for
        <strong>NPT (${escapedSubsidiary})</strong>.
      </p>
      <ol style="margin:0 0 16px 24px; padding:0; font-size:14px; color:#374151;">
        <li style="margin-bottom:4px;">Download and open the attached PDF form.</li>
        <li style="margin-bottom:4px;">Fill in all applicable sections and sign where indicated.</li>
        <li style="margin-bottom:4px;">Scan the completed form and gather the requested supporting documents.</li>
        <li>Reply to this email with the completed form and documents attached.</li>
      </ol>
      <p style="margin:0 0 4px 0;">Thank you,</p>
      <p style="margin:0 0 24px 0;">NPT HR</p>
    `;

    html = buildEmployeeEmailLayout({
      subject,
      heading: "Your onboarding form is attached",
      subtitle: `NPT (${escapedSubsidiary})`,
      bodyHtml,
      footerContactEmail: NPT_HR_EMAIL,
      footerNote: "Please ensure you include all required documents.",
    });
  }

  await sendMailAppOnly({
    from: NPT_HR_EMAIL,
    to: [to],
    subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  });
}
