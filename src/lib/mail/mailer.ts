// src/lib/mail/mailer.ts
import { ClientSecretCredential } from "@azure/identity";
import { AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID } from "@/config/env";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const credential = new ClientSecretCredential(AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET);

async function getAccessToken(): Promise<string> {
  const token = await credential.getToken(GRAPH_SCOPE);
  if (!token?.token) throw new Error("Failed to obtain Graph token");
  return token.token;
}

export type GraphAttachment = {
  name: string; // e.g., "ssp-email-banner.jpg"
  contentType: string; // e.g., "image/jpeg", "application/pdf"
  base64: string; // contentBytes (base64 without data: prefix)
  /** If provided with isInline=true, enables <img src="cid:..."> */
  contentId?: string; // e.g., "ssp-email-banner"
  isInline?: boolean; // true for inline (CID) images
};

export async function sendMailAppOnly(params: {
  from: string; // mailbox to send as
  to: string[]; // recipients
  subject: string;
  html?: string;
  text?: string;
  attachments?: GraphAttachment[];
  saveToSentItems?: boolean;
}) {
  const accessToken = await getAccessToken();

  const toRecipients = params.to.map((addr) => ({ emailAddress: { address: addr } }));

  const message: any = {
    subject: params.subject,
    body: {
      contentType: params.html ? "HTML" : "Text",
      content: params.html ?? params.text ?? "",
    },
    toRecipients,
  };

  if (params.attachments?.length) {
    message.attachments = params.attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentType: a.contentType,
      contentBytes: a.base64,
      ...(a.contentId ? { contentId: a.contentId } : {}),
      ...(a.isInline ? { isInline: true } : {}),
    }));
  }

  const res = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(params.from)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      saveToSentItems: params.saveToSentItems ?? true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sendMail failed: ${res.status} ${text}`);
  }
}
