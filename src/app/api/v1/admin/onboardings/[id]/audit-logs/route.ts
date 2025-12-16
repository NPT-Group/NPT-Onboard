// src/app/api/v1/admin/onboardings/[id]/audit-logs/route.ts
import { NextRequest } from "next/server";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";

import { OnboardingModel } from "@/mongoose/models/Onboarding";
import { OnboardingAuditLogModel } from "@/mongoose/models/OnboardingAuditLog";

import type { IOnboardingAuditLog } from "@/types/onboardingAuditLog.types";
import { parseIsoDate, inclusiveEndOfDay, parsePagination, parseSort, buildMeta } from "@/lib/utils/queryUtils";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type AuditLogListItem = {
  id: string;
  onboardingId: string;
  action: IOnboardingAuditLog["action"];
  message: string;
  actor: IOnboardingAuditLog["actor"];
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
};

type AuditLogListFilters = {
  from?: string | null;
  to?: string | null;
};

function mapAuditLogToItem(log: any): AuditLogListItem {
  return {
    id: log._id?.toString?.() ?? log.id ?? "",
    onboardingId: log.onboardingId?.toString?.() ?? "",
    action: log.action,
    message: log.message,
    actor: log.actor,
    createdAt: log.createdAt,
    metadata: log.metadata,
  };
}

/* -------------------------------------------------------------------------- */
/* GET /api/v1/admin/onboardings/[id]/audit-logs                               */
/* Pagination + date range filtering                                           */
/* -------------------------------------------------------------------------- */
/**
 * HR: Retrieve audit logs for a single onboarding record.
 *
 * Query params:
 * - page (default 1)
 * - pageSize (default 20, max 100)
 * - from (ISO date string, inclusive; filters createdAt >= from)
 * - to   (ISO date string, inclusive end-of-day; filters createdAt <= end-of-day(to))
 * - sortBy (createdAt) [currently only createdAt is allowed]
 * - sortDir (asc|desc) [default desc]
 *
 * Notes:
 * - Results are always scoped to a single onboardingId (path param).
 * - Date filtering applies to the audit log `createdAt` field.
 */
export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await connectDB();
    await guard(); // HR/admin only

    const { id: onboardingId } = await params;

    // Optional: ensure onboarding exists (better UX than returning empty logs for a bad id)
    const exists = await OnboardingModel.exists({ _id: onboardingId });
    if (!exists) {
      return errorResponse(404, "Onboarding not found");
    }

    const url = new URL(req.url);
    const sp = url.searchParams;

    const fromRaw = sp.get("from");
    const toRaw = sp.get("to");
    const fromDate = parseIsoDate(fromRaw);

    // If `to` is provided, treat it as inclusive end-of-day.
    // If it’s missing, we leave `toDate` undefined and don’t apply an upper bound.
    const toDate = toRaw ? inclusiveEndOfDay(parseIsoDate(toRaw) ?? new Date(), toRaw) : undefined;

    // Pagination
    const { page, limit, skip } = parsePagination(sp.get("page"), sp.get("pageSize"), 100);

    // Sorting (keep tight for now; you can expand later)
    const allowedSortKeys = ["createdAt"] as const;
    const { sortBy, sortDir } = parseSort(sp.get("sortBy"), sp.get("sortDir"), allowedSortKeys, "createdAt");

    // Build filter
    const filter: any = {
      onboardingId,
    };

    if (fromDate || toRaw) {
      filter.createdAt = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toRaw ? { $lte: toDate } : {}),
      };
    }

    const total = await OnboardingAuditLogModel.countDocuments(filter);

    const docs = await OnboardingAuditLogModel.find(filter)
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = (docs as any[]).map(mapAuditLogToItem);

    const filters: AuditLogListFilters = {
      from: fromRaw,
      to: toRaw,
    };

    const meta = buildMeta<AuditLogListFilters>({
      page,
      pageSize: limit,
      total,
      sortBy,
      sortDir,
      filters,
    });

    return successResponse(200, "Onboarding audit logs", { items, meta });
  } catch (error) {
    return errorResponse(error);
  }
};
