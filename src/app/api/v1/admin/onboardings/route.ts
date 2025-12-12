// src/app/api/v1/admin/onboardings/route.ts
import { NextRequest } from "next/server";
import fs from "fs/promises";
import crypto from "crypto";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { hashString } from "@/lib/utils/encryption";
import { buildOnboardingInvite, createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { sendEmployeeOnboardingInvitation } from "@/lib/mail/employee/sendEmployeeOnboardingInvitation";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus, type TOnboarding } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import type { GraphAttachment } from "@/lib/mail/mailer";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";

import { parseBool, rx, parseIsoDate, inclusiveEndOfDay, parseEnumParam, parsePagination, parseSort, buildMeta } from "@/lib/utils/queryUtils";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type PostBody = {
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;
  firstName: string;
  lastName: string;
  email: string;
};

type OnboardingListItem = {
  id: string;
  subsidiary: ESubsidiary;
  method: EOnboardingMethod;

  firstName: string;
  lastName: string;
  email: string;

  status: EOnboardingStatus;

  employeeNumber?: string;
  isFormComplete: boolean;
  isCompleted: boolean;

  modificationRequestedAt?: Date | string;
  terminationType?: string;

  createdAt: Date | string;
  updatedAt: Date | string;
  submittedAt?: Date | string;
  approvedAt?: Date | string;
  terminatedAt?: Date | string;
};

type OnboardingListFilters = {
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

/* -------------------------------------------------------------------------- */
/* Helper: Map TOnboarding → minimal admin list item                         */
/* -------------------------------------------------------------------------- */

function mapOnboardingToListItem(o: TOnboarding): OnboardingListItem {
  return {
    id: (o as any)._id?.toString?.() ?? (o as any).id ?? "",
    subsidiary: o.subsidiary,
    method: o.method,

    firstName: o.firstName,
    lastName: o.lastName,
    email: o.email,

    status: o.status,

    employeeNumber: o.employeeNumber,
    isFormComplete: o.isFormComplete,
    isCompleted: o.isCompleted,

    modificationRequestedAt: o.modificationRequestedAt,
    terminationType: (o as any).terminationType,

    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    submittedAt: o.submittedAt,
    approvedAt: (o as any).approvedAt,
    terminatedAt: (o as any).terminatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* GET /api/v1/admin/onboardings                                              */
/* Admin list endpoint: rich search + filtering + sorting + pagination         */
/*                                                                            */
/* Purpose                                                                    */
/* - Returns a paginated list of onboardings for a SINGLE subsidiary (IN/CA/US)*/
/* - Designed for the Admin dashboard table + chips/filters UI                 */
/* - Supports generic search, status chips, method filters, boolean flags,     */
/*   date-range filtering by selected lifecycle field, sorting, and pagination */
/*                                                                            */
/* Auth                                                                        */
/* - HR/Admin only (guard())                                                   */
/*                                                                            */
/* IMPORTANT: Subsidiary scoping (required)                                   */
/* - This endpoint is ALWAYS scoped to exactly one subsidiary via `subsidiary` */
/* - No cross-subsidiary searching is allowed (keeps dashboards separated)     */
/*                                                                            */
/* ----------------------------------------------------------------------------
 * Query Params
 * ----------------------------------------------------------------------------
 *
 * Required
 * - subsidiary: ESubsidiary
 *   Examples: IN | CA | US
 *
 * Search
 * - q: string (optional)
 *   Generic search across:
 *     - firstName
 *     - lastName
 *     - email
 *     - employeeNumber
 *   Behavior:
 *     - Uses a case-insensitive "contains" style regex (via rx())
 *     - Spaces/special chars are handled by rx() (escaped/sanitized)
 *   Examples:
 *     q=ridoy@sspgroup.com
 *     q=Faruq
 *     q=EMP-1029
 *
 * Method filter
 * - method: EOnboardingMethod (optional)
 *   Values: digital | manual
 *
 * Status filtering (two ways; `status` takes precedence if provided)
 * - status: string (optional)
 *   Comma-separated explicit statuses.
 *   Values: InviteGenerated, ManualPDFSent, ModificationRequested, Submitted,
 *           Resubmitted, Approved, Terminated
 *   Example:
 *     status=Submitted,Resubmitted
 *
 * - statusGroup: string (optional)
 *   Convenience groups for dashboard chips.
 *   Mapped to statuses:
 *     pending               -> [InviteGenerated]
 *     modificationRequested -> [ModificationRequested]
 *     pendingReview         -> [Submitted, Resubmitted]
 *     approved              -> [Approved]
 *     manual                -> [ManualPDFSent]
 *     terminated            -> [Terminated]
 *   Example:
 *     statusGroup=pendingReview
 *
 * Boolean filters
 * - hasEmployeeNumber: boolean (optional)
 *   true  -> requires employeeNumber to exist AND be a non-empty string
 *   false -> requires employeeNumber to be missing/null/empty string
 *
 * - isCompleted: boolean (optional)
 *   true/false matches the onboarding.isCompleted flag
 *
 * Date range filter
 * - dateField: "created" | "submitted" | "approved" | "terminated" | "updated" (optional)
 *   Default: "created"
 *
 * - from: string (optional)
 *   ISO date recommended: YYYY-MM-DD
 *   Example: from=2025-12-01
 *
 * - to: string (optional)
 *   ISO date recommended: YYYY-MM-DD
 *   The backend expands this to inclusive end-of-day (23:59:59.999) via inclusiveEndOfDay()
 *   Example: to=2025-12-12
 *
 * Notes:
 * - If `to` is provided and `from` is omitted, the filter becomes: field <= inclusiveEndOfDay(to)
 * - If `from` is provided and `to` is omitted, the filter becomes: field >= from
 * - If neither is provided, no date filtering is applied.
 *
 * Pagination
 * - page: number (optional)       default: 1
 * - pageSize: number (optional)   default: 20 (or whatever parsePagination defaults to)
 *   Hard cap: 100 (as configured in parsePagination(..., 100))
 *
 * Sorting
 * - sortBy: one of:
 *   createdAt | updatedAt | submittedAt | approvedAt | terminatedAt |
 *   firstName | lastName | email | status | employeeNumber
 *
 * - sortDir: "asc" | "desc"
 *   Default: sortBy=createdAt, sortDir=desc (based on parseSort default)
 *
 * ----------------------------------------------------------------------------
 * How filters combine (important for frontend expectations)
 * ----------------------------------------------------------------------------
 * All filters are combined with AND at the top level:
 * - subsidiary is always required AND applied
 * - method/status/statusGroup/booleans/date range are AND-ed
 *
 * Search `q` is implemented as an OR across searchable fields, but that OR block
 * is AND-ed with the rest of the filters.
 *
 * Conceptual logic:
 *   subsidiary == X
 *   AND (q matches firstName OR lastName OR email OR employeeNumber)   [if q provided]
 *   AND method == Y                                                   [if provided]
 *   AND status IN [...]                                               [if provided]
 *   AND isCompleted == true|false                                     [if provided]
 *   AND employeeNumber exists/non-empty OR missing/empty              [if provided]
 *   AND dateField between from..to (inclusive end-of-day for `to`)     [if provided]
 *
 * ----------------------------------------------------------------------------
 * Response (200)
 * ----------------------------------------------------------------------------
 * successResponse(200, "Onboardings list", { items, meta })
 *
 * data.items: OnboardingListItem[]
 *   Each item is a minimal list record for the admin table:
 *   {
 *     id: string,
 *     subsidiary: "IN"|"CA"|"US",
 *     method: "digital"|"manual",
 *     firstName: string,
 *     lastName: string,
 *     email: string,
 *     status: EOnboardingStatus,
 *     employeeNumber?: string,
 *     isFormComplete: boolean,
 *     isCompleted: boolean,
 *     modificationRequestedAt?: string|Date,
 *     terminationType?: string,
 *     createdAt: string|Date,
 *     updatedAt: string|Date,
 *     submittedAt?: string|Date,
 *     approvedAt?: string|Date,
 *     terminatedAt?: string|Date,
 *   }
 *
 * data.meta:
 *   {
 *     page: number,
 *     pageSize: number,
 *     total: number,
 *     totalPages: number,
 *     hasPrev: boolean,
 *     hasNext: boolean,
 *     sortBy: string,
 *     sortDir: "asc"|"desc",
 *     filters: {
 *       subsidiary: "IN"|"CA"|"US",
 *       q?: string|null,
 *       method?: "digital"|"manual"|null,
 *       statuses?: EOnboardingStatus[],
 *       hasEmployeeNumber?: boolean|null,
 *       isCompleted?: boolean|null,
 *       dateField: "created"|"submitted"|"approved"|"terminated"|"updated",
 *       from?: string|null,
 *       to?: string|null,
 *       statusGroup?: string|null
 *     }
 *   }
 *
 * ----------------------------------------------------------------------------
 * Examples (copy/paste ready)
 * ----------------------------------------------------------------------------
 *
 * 1) Basic list (subsidiary only; newest first)
 *   /api/v1/admin/onboardings?subsidiary=IN
 *
 * 2) Search by email (q hits email, AND all other filters)
 *   /api/v1/admin/onboardings?subsidiary=IN&q=ridoy@sspgroup.com
 *
 * 3) Search by name + method filter
 *   /api/v1/admin/onboardings?subsidiary=IN&q=Faruq&method=digital
 *
 * 4) Status group chip (pending review -> Submitted + Resubmitted)
 *   /api/v1/admin/onboardings?subsidiary=IN&statusGroup=pendingReview
 *
 * 5) Explicit status list (overrides statusGroup if both are present)
 *   /api/v1/admin/onboardings?subsidiary=IN&status=Submitted,Resubmitted
 *
 * 6) Missing employee number (only records without employeeNumber)
 *   /api/v1/admin/onboardings?subsidiary=IN&hasEmployeeNumber=false
 *
 * 7) Has employee number + completed only
 *   /api/v1/admin/onboardings?subsidiary=IN&hasEmployeeNumber=true&isCompleted=true
 *
 * 8) Date range by created date (ISO dates recommended)
 *   /api/v1/admin/onboardings?subsidiary=IN&dateField=created&from=2025-12-01&to=2025-12-12
 *
 * 9) Date range by submitted date + pending review + sort by submittedAt asc
 *   /api/v1/admin/onboardings?subsidiary=IN&statusGroup=pendingReview&dateField=submitted&from=2025-12-01&to=2025-12-12&sortBy=submittedAt&sortDir=asc
 *
 * 10) Full power query (uses almost everything)
 *   /api/v1/admin/onboardings?subsidiary=IN
 *     &q=ridoy@sspgroup.com
 *     &method=digital
 *     &status=Submitted,Resubmitted
 *     &hasEmployeeNumber=false
 *     &isCompleted=false
 *     &dateField=updated
 *     &from=2025-12-01
 *     &to=2025-12-12
 *     &sortBy=updatedAt
 *     &sortDir=desc
 *     &page=1
 *     &pageSize=20
 */
/* -------------------------------------------------------------------------- */
export const GET = async (req: NextRequest) => {
  try {
    await connectDB();
    await guard(); // ensure HR/admin only

    const url = new URL(req.url);
    const sp = url.searchParams;

    // ── Required: subsidiary context (no cross-mixing between IN/CA/US) :contentReference[oaicite:0]{index=0}
    const subsidiary = parseEnumParam(sp.get("subsidiary"), Object.values(ESubsidiary) as readonly ESubsidiary[], "subsidiary");
    if (!subsidiary) {
      return errorResponse(400, "subsidiary query param is required");
    }

    // Generic search: name / email / employeeNumber
    const q = sp.get("q");

    // Method filter: digital / manual
    const method = parseEnumParam(sp.get("method"), Object.values(EOnboardingMethod) as readonly EOnboardingMethod[], "method");

    // Status filter (comma-separated list)
    const statusRaw = sp.get("status");
    let statuses: EOnboardingStatus[] | undefined;

    if (statusRaw) {
      const parts = statusRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const allowed = Object.values(EOnboardingStatus) as readonly EOnboardingStatus[];
      statuses = parts.map((p) => {
        const val = parseEnumParam(p, allowed, "status");
        // parseEnumParam will throw if invalid
        return val as EOnboardingStatus;
      });
    } else {
      // Optional status groups to match the dashboard chips :contentReference[oaicite:1]{index=1}
      const statusGroup = sp.get("statusGroup");
      const groupMap: Record<string, EOnboardingStatus[]> = {
        pending: [EOnboardingStatus.InviteGenerated],
        modificationRequested: [EOnboardingStatus.ModificationRequested],
        pendingReview: [EOnboardingStatus.Submitted, EOnboardingStatus.Resubmitted],
        approved: [EOnboardingStatus.Approved],
        manual: [EOnboardingStatus.ManualPDFSent],
        terminated: [EOnboardingStatus.Terminated],
      };
      if (statusGroup && groupMap[statusGroup]) {
        statuses = groupMap[statusGroup];
      }
    }

    // Booleans
    const hasEmployeeNumber = parseBool(sp.get("hasEmployeeNumber"));
    const isCompleted = parseBool(sp.get("isCompleted"));

    // Date filtering (Created / Submitted / Approved / Terminated / Updated) :contentReference[oaicite:2]{index=2}
    const allowedDateFields = ["created", "submitted", "approved", "terminated", "updated"] as const;
    const dateFieldRaw = sp.get("dateField") as (typeof allowedDateFields)[number] | null;
    const dateField: (typeof allowedDateFields)[number] = allowedDateFields.includes(dateFieldRaw ?? "created") ? (dateFieldRaw as any) || "created" : "created";

    const dateFieldMap: Record<(typeof allowedDateFields)[number], keyof TOnboarding> = {
      created: "createdAt",
      submitted: "submittedAt",
      approved: "approvedAt",
      terminated: "terminatedAt",
      updated: "updatedAt",
    };

    const fromRaw = sp.get("from");
    const toRaw = sp.get("to");
    const fromDate = parseIsoDate(fromRaw);
    const toDate = inclusiveEndOfDay(parseIsoDate(toRaw) ?? new Date(), toRaw ?? null);

    // Pagination & sorting
    const { page, limit, skip } = parsePagination(sp.get("page"), sp.get("pageSize"), 100);
    const allowedSortKeys = ["createdAt", "updatedAt", "submittedAt", "approvedAt", "terminatedAt", "firstName", "lastName", "email", "status", "employeeNumber"] as const;

    const { sortBy, sortDir } = parseSort(sp.get("sortBy"), sp.get("sortDir"), allowedSortKeys, "createdAt");

    // ── Build Mongo filter
    const filter: any = {
      subsidiary, // always scoped to one subsidiary :contentReference[oaicite:3]{index=3}
    };

    if (q && q.trim()) {
      const pattern = rx(q.trim());
      filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }, { employeeNumber: pattern }];
    }

    if (method) {
      filter.method = method;
    }

    if (statuses && statuses.length > 0) {
      filter.status = { $in: statuses };
    }

    if (hasEmployeeNumber !== null) {
      if (hasEmployeeNumber) {
        // must have a non-empty string employeeNumber
        filter.employeeNumber = { $exists: true, $type: "string", $ne: "" };
      } else {
        // must NOT have an employeeNumber
        const missingEmployeeNumberOr = {
          $or: [{ employeeNumber: { $exists: false } }, { employeeNumber: null }, { employeeNumber: "" }],
        };

        if (filter.$and) {
          filter.$and.push(missingEmployeeNumberOr);
        } else {
          filter.$and = [missingEmployeeNumberOr];
        }
      }
    }

    if (isCompleted !== null) {
      filter.isCompleted = isCompleted;
    }

    if (fromDate || toRaw) {
      const field = dateFieldMap[dateField];
      filter[field] = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toRaw ? { $lte: toDate } : {}),
      };
    }

    // ── Query DB
    const total = await OnboardingModel.countDocuments(filter);
    const docs = (await OnboardingModel.find(filter)
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as TOnboarding[];

    const items = docs.map(mapOnboardingToListItem);

    const filters: OnboardingListFilters = {
      subsidiary,
      q,
      method: method ?? null,
      statuses,
      hasEmployeeNumber,
      isCompleted,
      dateField,
      from: fromRaw,
      to: toRaw,
      statusGroup: sp.get("statusGroup"),
    };

    const meta = buildMeta<OnboardingListFilters>({
      page,
      pageSize: limit,
      total,
      sortBy,
      sortDir,
      filters,
    });

    return successResponse(200, "Onboardings list", { items, meta });
  } catch (error) {
    return errorResponse(error);
  }
};

/* -------------------------------------------------------------------------- */
/* POST /api/v1/admin/onboardings                                             */
/* Existing: create onboarding + send invite/PDF                              */
/* -------------------------------------------------------------------------- */
export const POST = async (req: NextRequest) => {
  try {
    await connectDB();
    const user = await guard();

    const body = await parseJsonBody<PostBody>(req);
    const { subsidiary, method, firstName, lastName, email } = body;

    if (!subsidiary || !method || !firstName || !lastName || !email) {
      return errorResponse(400, "Missing required fields");
    }

    if (subsidiary !== ESubsidiary.INDIA) {
      return errorResponse(400, "Only INDIA subsidiary onboarding is supported at this time");
    }

    if (method !== EOnboardingMethod.DIGITAL && method !== EOnboardingMethod.MANUAL) {
      return errorResponse(400, "Invalid onboarding method");
    }

    /* ----------------- Prevent duplicate active onboardings ----------------- */
    const existing = await OnboardingModel.findOne({
      subsidiary,
      email,
      status: { $ne: EOnboardingStatus.Terminated },
    }).lean();

    if (existing) {
      return errorResponse(409, "An active onboarding already exists for this email in this subsidiary");
    }

    const now = new Date();

    const onboarding = new OnboardingModel({
      subsidiary,
      method,
      firstName,
      lastName,
      email,
      status: method === EOnboardingMethod.DIGITAL ? EOnboardingStatus.InviteGenerated : EOnboardingStatus.ManualPDFSent,
      isFormComplete: false,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    let rawInviteToken: string | undefined;

    /* ---------------- DIGITAL: generate invite token + hash ---------------- */
    if (method === EOnboardingMethod.DIGITAL) {
      // random opaque token
      rawInviteToken = crypto.randomBytes(32).toString("hex");

      const invite = buildOnboardingInvite(rawInviteToken);
      // hash the token before saving
      invite.tokenHash = hashString(rawInviteToken)!;

      // attach invite to onboarding
      onboarding.invite = invite;
    }

    // Validate and persist the onboarding record
    await onboarding.validate();
    await onboarding.save();

    /* ---------------------- Email sending logic (with rollback) ---------------------- */
    const baseUrl = req.nextUrl.origin;

    try {
      if (method === EOnboardingMethod.DIGITAL) {
        await sendEmployeeOnboardingInvitation({
          to: email,
          firstName,
          lastName,
          method,
          subsidiary,
          baseUrl,
          inviteToken: rawInviteToken!, // safe: only set for DIGITAL
        });

        // Audit: digital invite generated
        await createOnboardingAuditLogSafe({
          onboardingId: onboarding._id.toString(),
          action: EOnboardingAuditAction.INVITE_GENERATED,
          actor: {
            type: EOnboardingActor.HR,
            id: user.id,
            name: user.name,
            email: user.email,
          },
          metadata: {
            status: onboarding.status,
            method,
            subsidiary,
          },
        });
      } else {
        // MANUAL: attach blank India onboarding PDF
        const pdfPath = `${process.cwd()}/src/lib/assets/pdfs/npt-india-onboarding-form.pdf`;
        const pdfBuffer = await fs.readFile(pdfPath);

        const manualFormAttachment: GraphAttachment = {
          name: "NPT-India-Onboarding-Form.pdf",
          contentType: "application/pdf",
          base64: pdfBuffer.toString("base64"),
        };

        await sendEmployeeOnboardingInvitation({
          to: email,
          firstName,
          lastName,
          method,
          subsidiary,
          baseUrl,
          manualFormAttachment,
        });

        // Audit: manual onboarding created / status set to ManualPDFSent
        await createOnboardingAuditLogSafe({
          onboardingId: onboarding._id.toString(),
          action: EOnboardingAuditAction.MANUAL_PDF_SENT,
          actor: {
            type: EOnboardingActor.HR,
            id: user.id,
            name: user.name,
            email: user.email,
          },
          metadata: {
            newStatus: onboarding.status,
            method,
            subsidiary,
          },
        });
      }
    } catch (emailError) {
      // Rollback: delete the onboarding doc if email (or PDF read) fails
      try {
        await OnboardingModel.findByIdAndDelete(onboarding._id);
      } catch (cleanupError) {
        console.error("Failed to rollback onboarding after email error", cleanupError);
      }

      throw emailError;
    }

    return successResponse(201, "Onboarding created", {
      onboarding,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
