// src/lib/mail/employee/sendEmployeeOnboardingOtp.ts
import { ESubsidiary } from "@/types/shared.types";
import { sendMailAppOnly } from "@/lib/mail/mailer";
import { escapeHtml } from "@/lib/mail/utils";
import { NPT_HR_EMAIL } from "@/config/env";

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

  const subject = "Your NPT Onboarding Verification Code";

  const html = `
    <p>Hi ${escapedName},</p>
    <p>
      Your one-time verification code for NPT (${escapedSubsidiary}) employee onboarding is:
    </p>
    <p style="font-size: 20px; font-weight: bold;">
      ${escapedOtp}
    </p>
    <p>
      This code is valid for the next ${escapeHtml(String(expiresInMinutes))} minutes.
      For security reasons, please do not share this code with anyone.
    </p>
    <p>If you did not request this code, you can safely ignore this email.</p>
    <p>Thank you,<br/>NPT HR</p>
  `;

  await sendMailAppOnly({
    from: NPT_HR_EMAIL,
    to: [to],
    subject,
    html,
  });
}
