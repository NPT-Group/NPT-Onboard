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
  statusGroup?:
    | "pending"
    | "modificationRequested"
    | "pendingReview"
    | "approved"
    | "manual"
    | "terminated";
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

export async function terminateOnboarding(
  id: string,
  body: { terminationType: ETerminationType; terminationReason?: string }
) {
  return postJson<typeof body, { onboarding: any }>(
    `/api/v1/admin/onboardings/${id}/terminate`,
    body
  );
}

export type CreateAdminOnboardingBody = {
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;
  firstName: string;
  lastName: string;
  email: string;
};

export async function createAdminOnboarding(body: CreateAdminOnboardingBody) {
  return postJson<CreateAdminOnboardingBody, { onboarding: any }>(
    "/api/v1/admin/onboardings",
    body
  );
}

export async function resendOnboardingInvite(id: string) {
  return postJson<undefined, { onboarding: any }>(
    `/api/v1/admin/onboardings/${id}/resend-invite`,
    undefined
  );
}

export async function restoreOnboarding(id: string) {
  return postJson<undefined, { onboarding: any }>(
    `/api/v1/admin/onboardings/${id}/restore`,
    undefined
  );
}

export async function deleteOnboarding(id: string) {
  return request<{ deleted: { id: string; deletedS3KeysCount: number } }>(
    `/api/v1/admin/onboardings/${id}`,
    { method: "DELETE" }
  );
}

