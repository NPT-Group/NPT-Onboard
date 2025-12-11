// src/lib/mail/templates/buildEmployeeEmailLayout.ts
import { escapeHtml } from "@/lib/mail/utils";

type BuildEmployeeEmailLayoutOptions = {
  subject: string;
  heading: string;
  subtitle?: string;
  /**
   * Inner HTML for the main body content (paragraphs, buttons, etc.).
   * Any dynamic values inside should already be escaped where appropriate.
   */
  bodyHtml: string;
  /**
   * Optional extra footer note, plain text.
   */
  footerNote?: string;
  /**
   * Email shown in the footer as the HR/contact email.
   */
  footerContactEmail?: string;
};

export function buildEmployeeEmailLayout(options: BuildEmployeeEmailLayoutOptions): string {
  const { subject, heading, subtitle, bodyHtml, footerNote, footerContactEmail } = options;

  const safeSubject = escapeHtml(subject);
  const safeHeading = escapeHtml(heading);
  const safeSubtitle = subtitle ? escapeHtml(subtitle) : "";
  const safeFooterNote = footerNote ? escapeHtml(footerNote) : "";
  const safeFooterEmail = footerContactEmail ? escapeHtml(footerContactEmail) : "";

  const subtitleBlock = safeSubtitle ? `<p style="margin:0; font-size:13px; color:#6b7280;">${safeSubtitle}</p>` : "";

  const footerEmailBlock = safeFooterEmail
    ? `
      For any questions, please contact HR at
      <a href="mailto:${safeFooterEmail}" style="color:#2563eb; text-decoration:none;">${safeFooterEmail}</a>.
    `
    : "";

  const footerNoteBlock = safeFooterNote ? ` ${safeFooterNote}` : "";

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="UTF-8" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color:#f3f4f6; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                <p style="margin:0 0 4px 0; font-size:20px; font-weight:600; color:#111827;">
                  ${safeHeading}
                </p>
                ${subtitleBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; color:#374151;">
                ${bodyHtml}
                <p style="margin:0; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:16px;">
                  This message was sent automatically by the NPT Onboarding system.${footerNoteBlock}
                  ${footerEmailBlock}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}
