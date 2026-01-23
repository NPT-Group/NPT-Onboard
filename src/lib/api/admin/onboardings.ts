// src/lib/api/admin/onboardings.ts
"use client";

import { request, postJson } from "@/lib/api/client";
import { ESubsidiary } from "@/types/shared.types";
import { EOnboardingMethod, EOnboardingStatus, ETerminationType } from "@/types/onboarding.types";

export type AdminOnboardingListItem = {
  id: string;
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;
  firstName: string;
  lastName: string;
  email: string;
  status: EOnboardingStatus;
  inviteUrl?: string;
  inviteExpiresAt?: string | Date;
  employeeNumber?: string;
  isFormComplete: boolean;
  isCompleted: boolean;
  modificationRequestedAt?: string | Date;
  terminationType?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  submittedAt?: string | Date;
  approvedAt?: string | Date;
  terminatedAt?: string | Date;
};

export type AdminListMeta<TFilters> = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  filters: TFilters;
};

export type AdminOnboardingsListFilters = {
  subsidiary: ESubsidiary;
  q?: string | null;
  method?: EOnboardingMethod | null;
  statuses?: EOnboardingStatus[];
  hasEmployeeNumber?: boolean | null;
  isCompleted?: boolean | null;
  dateField: "created" | "submitted" | "approved" | "terminated" | "updated";
  from?: string | null;
  to?: string | null;
  statusGroup?: string | null;
};

export type GetAdminOnboardingsResponse = {
  items: AdminOnboardingListItem[];
  meta: AdminListMeta<AdminOnboardingsListFilters>;
};

export type GetAdminOnboardingsParams = {
  subsidiary: ESubsidiary;
  q?: string;
  statusGroup?: "pending" | "modificationRequested" | "pendingReview" | "approved" | "manual" | "terminated";
  hasEmployeeNumber?: "true" | "false";
  dateField?: AdminOnboardingsListFilters["dateField"];
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function getAdminOnboardings(params: GetAdminOnboardingsParams) {
  const sp = new URLSearchParams();
  sp.set("subsidiary", params.subsidiary);
  if (params.q) sp.set("q", params.q);
  if (params.statusGroup) sp.set("statusGroup", params.statusGroup);
  if (params.hasEmployeeNumber) sp.set("hasEmployeeNumber", params.hasEmployeeNumber);
  if (params.dateField) sp.set("dateField", params.dateField);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortDir) sp.set("sortDir", params.sortDir);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));

  return request<GetAdminOnboardingsResponse>(`/api/v1/admin/onboardings?${sp.toString()}`);
}

export async function terminateOnboarding(id: string, body: { terminationType: ETerminationType; terminationReason?: string }) {
  return postJson<typeof body, { onboarding: any }>(`/api/v1/admin/onboardings/${id}/terminate`, body);
}

/* -------------------------------------------------------------------------- */
/* Single onboarding detail + actions (HR detail view)                         */
/* -------------------------------------------------------------------------- */

export async function getAdminOnboarding(id: string) {
  return request<{ onboarding: any }>(`/api/v1/admin/onboardings/${id}`);
}

export async function approveOnboarding(id: string, body: { employeeNumber?: string }) {
  return postJson<typeof body, { onboarding: any }>(`/api/v1/admin/onboardings/${id}/approve`, body);
}

export async function confirmDetailsOnboarding(id: string) {
  return postJson<undefined, { onboarding: any }>(`/api/v1/admin/onboardings/${id}/confirm-details`, undefined);
}

export async function requestModification(id: string, body: { message: string }) {
  return postJson<typeof body, { onboarding: any }>(`/api/v1/admin/onboardings/${id}/request-modification`, body);
}

export async function updateAdminOnboarding(id: string, body: { indiaFormData: any }) {
  return request<{ onboarding: any }>(`/api/v1/admin/onboardings/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export type AuditLogListItem = {
  id: string;
  onboardingId: string;
  action: string;
  message: string;
  actor: any;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
};

export type AuditLogListMeta<TFilters> = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  filters: TFilters;
};

export async function getOnboardingAuditLogs(params: { id: string; page?: number; pageSize?: number; from?: string; to?: string; sortBy?: "createdAt"; sortDir?: "asc" | "desc" }) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortDir) sp.set("sortDir", params.sortDir);

  return request<{
    items: AuditLogListItem[];
    meta: AuditLogListMeta<{ from?: string | null; to?: string | null }>;
  }>(`/api/v1/admin/onboardings/${params.id}/audit-logs?${sp.toString()}`);
}

export type CreateAdminOnboardingBody = {
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;
  firstName: string;
  lastName: string;
  email: string;
};

export async function createAdminOnboarding(body: CreateAdminOnboardingBody) {
  return postJson<CreateAdminOnboardingBody, { onboarding: any }>("/api/v1/admin/onboardings", body);
}

export async function resendOnboardingInvite(id: string) {
  return postJson<undefined, { onboarding: any }>(`/api/v1/admin/onboardings/${id}/resend-invite`, undefined);
}

export async function restoreOnboarding(id: string) {
  return postJson<undefined, { onboarding: any }>(`/api/v1/admin/onboardings/${id}/restore`, undefined);
}

export async function deleteOnboarding(id: string) {
  return request<{ deleted: { id: string; deletedS3KeysCount: number } }>(`/api/v1/admin/onboardings/${id}`, { method: "DELETE" });
}

// Add these types near the top (or near other helper types)
type FileFormat = "csv" | "xlsx";

export type GenerateReportResponse = {
  jobId: string;
  statusUrl: string;
};

type JobState = "PENDING" | "RUNNING" | "DONE" | "ERROR";
export type OnboardingsReportJobStatus = {
  state: JobState;
  progressPercent: number;
  processed: number;
  total: number | null;
  rowCount: number | null;

  format: FileFormat;
  startedAt: string | null;
  updatedAt: string;

  downloadKey: string | null;
  downloadUrl: string | null;

  errorMessage?: string | null;
};

/**
 * Starts an export job. Pass query params that match list filters, but
 * do NOT include page/pageSize if you want full export.
 */
export async function generateOnboardingsReport(params: {
  // required
  subsidiary: ESubsidiary;

  // existing list params you already use
  q?: string;
  statusGroup?: string;
  hasEmployeeNumber?: "true" | "false";
  dateField?: "created" | "submitted" | "approved" | "terminated" | "updated";
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";

  // export options
  format?: FileFormat; // default to xlsx in caller
  filename?: string;
}) {
  const sp = new URLSearchParams();
  sp.set("subsidiary", params.subsidiary);

  if (params.q) sp.set("q", params.q);
  if (params.statusGroup) sp.set("statusGroup", params.statusGroup);
  if (params.hasEmployeeNumber) sp.set("hasEmployeeNumber", params.hasEmployeeNumber);
  if (params.dateField) sp.set("dateField", params.dateField);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortDir) sp.set("sortDir", params.sortDir);

  if (params.format) sp.set("format", params.format);
  if (params.filename) sp.set("filename", params.filename);

  // POST with empty body (route supports body or query params)
  return request<GenerateReportResponse>(`/api/v1/admin/onboardings/generate-report?${sp.toString()}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getOnboardingsReportStatus(jobId: string) {
  return request<{ jobId: string; status: OnboardingsReportJobStatus }>(`/api/v1/admin/onboardings/generate-report/status?jobId=${encodeURIComponent(jobId)}`);
}
