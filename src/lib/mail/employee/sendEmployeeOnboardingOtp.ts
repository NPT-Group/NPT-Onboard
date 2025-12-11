import { ESubsidiary } from "@/types/shared.types";
import { sendMailAppOnly } from "@/lib/mail/mailer";
import { escapeHtml } from "@/lib/mail/utils";
import { NPT_HR_EMAIL } from "@/config/env";
import { buildEmployeeEmailLayout } from "@/lib/mail/templates/buildEmployeeEmailLayout";

export type SendEmployeeOnboardingOtpParams = {
  to: string;
  firstName: string;
  lastName: string;
  subsidiary: ESubsidiary;
  otpCode: string; // 6-digit OTP
  expiresInMinutes: number;
};

export async function sendEmployeeOnboardingOtp(params: SendEmployeeOnboardingOtpParams): Promise<void> {
  const { to, firstName, lastName, subsidiary, otpCode, expiresInMinutes } = params;

  const fullName = `${firstName} ${lastName}`.trim();
  const escapedName = escapeHtml(fullName || "there");
  const escapedSubsidiary = escapeHtml(subsidiary);
  const escapedOtp = escapeHtml(otpCode);
  const escapedExpires = escapeHtml(String(expiresInMinutes));

  const subject = "Your NPT Onboarding Verification Code";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${escapedName},</p>
    <p style="margin:0 0 12px 0;">
      Use the code below to verify your email and continue your onboarding for
      <strong>NPT (${escapedSubsidiary})</strong>.
    </p>
    <div style="margin:16px 0 16px 0; text-align:center;">
      <div style="
        display:inline-block;
        padding:10px 20px;
        font-size:20px;
        letter-spacing:4px;
        font-weight:600;
        border-radius:9999px;
        background-color:#f3f4f6;
        border:1px solid #e5e7eb;
        color:#111827;
      ">
        ${escapedOtp}
      </div>
    </div>
    <p style="margin:0 0 8px 0;">
      This code expires in <strong>${escapedExpires} minutes</strong>.
    </p>
    <p style="margin:0 0 12px 0;">
      For security reasons, please do not share this code with anyone. NPT will never ask you
      to forward this code by phone or chat.
    </p>
    <p style="margin:0 0 12px 0; font-size:13px; color:#6b7280;">
      If you did not request this code, you can safely ignore this email.
    </p>
    <p style="margin:0 0 4px 0;">Thank you,</p>
    <p style="margin:0 0 24px 0;">NPT HR</p>
  `;

  const html = buildEmployeeEmailLayout({
    subject,
    heading: "Your verification code",
    subtitle: `NPT (${escapedSubsidiary}) Onboarding`,
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
