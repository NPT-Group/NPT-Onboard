// src/lib/mail/employee/sendEmployeeOnboardingInvitation.ts
import { EOnboardingMethod } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import { sendMailAppOnly, type GraphAttachment } from "@/lib/mail/mailer";
import { escapeHtml } from "@/lib/mail/utils";
import { NPT_HR_EMAIL } from "@/config/env";

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

  let subject: string;
  let html: string;
  const attachments: GraphAttachment[] = [];

  if (method === EOnboardingMethod.DIGITAL) {
    if (!inviteToken) {
      throw new Error("inviteToken is required for digital onboarding emails");
    }

    // You said: siteurl/onboarding?token=theinvitetoken
    const link = `${baseUrl}/onboarding?token=${encodeURIComponent(inviteToken)}`;
    const escapedLink = escapeHtml(link);

    subject = "NPT Employee Onboarding – Complete Your Details";

    html = `
      <p>Hi ${escapedName},</p>
      <p>
        You have been invited to complete your employee onboarding for NPT
        (${escapeHtml(subsidiary)}).
      </p>
      <p>
        Please click the link below to securely complete your onboarding form:
      </p>
      <p>
        <a href="${escapedLink}">${escapedLink}</a>
      </p>
      <p>
        For security reasons, this link is time-limited. If it expires, please contact HR to receive a new invitation.
      </p>
      <p>Thank you,<br/>NPT HR</p>
    `;
  } else {
    // MANUAL flow
    if (!manualFormAttachment) {
      throw new Error("manualFormAttachment is required for manual onboarding emails");
    }

    attachments.push(manualFormAttachment);

    subject = "NPT Employee Onboarding – Manual Form Attached";

    html = `
      <p>Hi ${escapedName},</p>
      <p>
        Please find attached the NPT (${escapeHtml(subsidiary)}) employee onboarding form.
      </p>
      <p>
        Kindly complete all applicable sections, sign where indicated, and return the form
        along with the requested supporting documents to this email address.
      </p>
      <p>Thank you,<br/>NPT HR</p>
    `;
  }

  await sendMailAppOnly({
    from: NPT_HR_EMAIL,
    to: [to],
    subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  });
}
