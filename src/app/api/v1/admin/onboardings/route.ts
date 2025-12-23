// src/app/api/v1/admin/onboardings/route.ts
import { NextRequest } from "next/server";
import fs from "fs/promises";
import crypto from "crypto";

import connectDB from "@/lib/utils/connectDB";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { guard } from "@/lib/utils/auth/authUtils";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { decryptString, hashString } from "@/lib/utils/encryption";
import { buildOnboardingInvite, createOnboardingAuditLogSafe } from "@/lib/utils/onboardingUtils";
import { sendEmployeeOnboardingInvitation } from "@/lib/mail/employee/sendEmployeeOnboardingInvitation";

import { OnboardingModel } from "@/mongoose/models/Onboarding";

import { EOnboardingMethod, EOnboardingStatus, type TOnboarding } from "@/types/onboarding.types";
import { ESubsidiary } from "@/types/shared.types";
import type { GraphAttachment } from "@/lib/mail/mailer";
import { EOnboardingActor, EOnboardingAuditAction } from "@/types/onboardingAuditLog.types";

import { parseBool, parseIsoDate, inclusiveEndOfDay, parseEnumParam, parsePagination, parseSort, buildMeta, rx } from "@/lib/utils/queryUtils";

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

  /** Present for DIGITAL onboardings only (so HR can copy the existing invite link). */
  inviteUrl?: string;
  inviteExpiresAt?: Date | string;

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

function mapOnboardingToListItem(o: TOnboarding, baseUrl: string): OnboardingListItem {
  const inviteTokenEncrypted = (o as any).invite?.tokenEncrypted as string | undefined;
  const inviteToken = inviteTokenEncrypted ? decryptString(inviteTokenEncrypted) : undefined;
  const inviteUrl = o.method === EOnboardingMethod.DIGITAL && inviteToken ? `${baseUrl}/onboarding?token=${encodeURIComponent(inviteToken)}` : undefined;

  return {
    id: (o as any)._id?.toString?.() ?? (o as any).id ?? "",
    subsidiary: o.subsidiary,
    method: o.method,

    firstName: o.firstName,
    lastName: o.lastName,
    email: o.email,

    status: o.status,

    inviteUrl,
    inviteExpiresAt: (o as any).invite?.expiresAt,

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
/*                                                                            */
/* HR/Admin-only endpoint to list onboardings for a single subsidiary with     */
/* search, filtering, sorting, and pagination.                                 */
/*                                                                            */
/* Scoping rules:                                                             */
/*  - Results are ALWAYS scoped to exactly one subsidiary (no cross-mixing).   */
/*  - By default, TERMINATED onboardings are excluded unless explicitly        */
/*    requested via:                                                          */
/*      - status includes "Terminated", OR                                     */
/*      - statusGroup=terminated                                               */
/*                                                                            */
/* Query params:                                                               */
/*  - subsidiary (required): IN|CA|US                                          */
/*  - q (optional): case-insensitive regex search across:                      */
/*      firstName, lastName, email, employeeNumber                             */
/*  - method (optional): digital|manual (invalid -> 400)                       */
/*  - status (optional): comma-separated list of statuses                       */
/*      (each must be a valid EOnboardingStatus; invalid -> 400)               */
/*  - statusGroup (optional): dashboard shortcut (ignored if status is set;    */
/*      still validated if provided; invalid -> 400)                           */
/*      allowed: pending | modificationRequested | pendingReview | approved |  */
/*               manual | terminated                                           */
/*  - hasEmployeeNumber (optional): true|false                                 */
/*      true  -> employeeNumber exists and is a non-empty string               */
/*      false -> employeeNumber missing/null/empty                             */
/*  - isCompleted (optional): true|false                                       */
/*  - dateField (optional): created|submitted|approved|terminated|updated       */
/*      (defaults to "created"; invalid -> 400)                                */
/*  - from (optional): date lower bound (inclusive). Must be parseable by      */
/*      parseIsoDate; invalid -> 400                                           */
/*  - to (optional): date upper bound (inclusive). Must be parseable by        */
/*      parseIsoDate; invalid -> 400                                           */
/*      Note: if "to" is provided as YYYY-MM-DD, it is treated as end-of-day   */
/*      (23:59:59.999) in server timezone.                                     */
/*  - sortBy (optional):                                                      */
/*      createdAt|updatedAt|submittedAt|approvedAt|terminatedAt|firstName|      */
/*      lastName|email|status|employeeNumber                                   */
/*      (defaults to createdAt; invalid -> 400)                                */
/*  - sortDir (optional): asc|desc (defaults to desc; invalid -> 400)          */
/*  - page (optional): 1-based page number (default 1)                         */
/*  - pageSize (optional): items per page (default 20; max 100)                */
/*                                                                            */
/* Examples:                                                                   */
/*  - Basic:                                                                   */
/*      GET /api/v1/admin/onboardings?subsidiary=IN                             */
/*  - With filters:                                                           */
/*      GET /api/v1/admin/onboardings                                          */
/*        ?subsidiary=IN                                                       */
/*        &q=arjun                                                             */
/*        &method=digital                                                      */
/*        &status=Submitted,Resubmitted,Approved                               */
/*        &hasEmployeeNumber=true                                              */
/*        &isCompleted=true                                                    */
/*        &dateField=submitted                                                 */
/*        &from=2025-01-01                                                     */
/*        &to=2025-12-31                                                       */
/*        &sortBy=updatedAt                                                    */
/*        &sortDir=desc                                                        */
/*        &page=1                                                              */
/*        &pageSize=25                                                         */
/*                                                                            */
/* Response (200):                                                             */
/*  {                                                                          */
/*    items: OnboardingListItem[],                                             */
/*    meta: {                                                                  */
/*      page, pageSize, total, totalPages, hasPrev, hasNext,                   */
/*      sortBy, sortDir, filters                                               */
/*    }                                                                        */
/*  }                                                                          */
/*                                                                            */
/* Error cases:                                                                */
/*  - 400: missing/invalid subsidiary, or invalid query params                 */
/*  - 401/403: not authorized                                                  */
/* -------------------------------------------------------------------------- */

export const GET = async (req: NextRequest) => {
  try {
    await connectDB();
    await guard(); // ensure HR/admin only

    const url = new URL(req.url);
    const sp = url.searchParams;
    const baseUrl = url.origin;
    const statusGroupRaw = sp.get("statusGroup");

    if (statusGroupRaw != null) {
      const allowedStatusGroups = ["pending", "modificationRequested", "pendingReview", "approved", "manual", "terminated"] as const;
      parseEnumParam(statusGroupRaw, allowedStatusGroups, "statusGroup");
    }

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

      const groupMap: Record<string, EOnboardingStatus[]> = {
        pending: [EOnboardingStatus.InviteGenerated],
        modificationRequested: [EOnboardingStatus.ModificationRequested],
        pendingReview: [EOnboardingStatus.Submitted, EOnboardingStatus.Resubmitted],
        approved: [EOnboardingStatus.Approved],
        manual: [EOnboardingStatus.ManualPDFSent],
        terminated: [EOnboardingStatus.Terminated],
      };

      if (statusGroupRaw) {
        statuses = groupMap[statusGroupRaw];
      }
    }

    // Booleans
    const hasEmployeeNumber = parseBool(sp.get("hasEmployeeNumber"));
    const isCompleted = parseBool(sp.get("isCompleted"));

    // Date filtering (Created / Submitted / Approved / Terminated / Updated)
    const allowedDateFields = ["created", "submitted", "approved", "terminated", "updated"] as const;

    const dateField = parseEnumParam(sp.get("dateField"), allowedDateFields, "dateField") ?? "created";

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
    if (fromRaw && !fromDate) {
      return errorResponse(400, "Invalid 'from' date. Expected ISO format like 2025-12-12 or full ISO datetime.");
    }

    const toParsed = parseIsoDate(toRaw);
    if (toRaw && !toParsed) {
      return errorResponse(400, "Invalid 'to' date. Expected ISO format like 2025-12-17 or full ISO datetime.");
    }

    const toDate = toParsed ? inclusiveEndOfDay(toParsed, toRaw) : null;

    // Pagination & sorting
    const { page, limit, skip } = parsePagination(sp.get("page"), sp.get("pageSize"), 100);
    const allowedSortKeys = ["createdAt", "updatedAt", "submittedAt", "approvedAt", "terminatedAt", "firstName", "lastName", "email", "status", "employeeNumber"] as const;

    const { sortBy, sortDir } = parseSort(sp.get("sortBy"), sp.get("sortDir"), allowedSortKeys, "createdAt");

    // ── Build Mongo filter
    const filter: any = {
      subsidiary, // always scoped to one subsidiary
    };

    // Apply method filter (you were parsing it but not using it)
    if (method) {
      filter.method = method;
    }

    // Apply q filter
    if (q && q.trim()) {
      const tokens = q.trim().split(/\s+/).filter(Boolean);

      const tokenAndClauses = tokens.map((t) => {
        const r = rx(t); // your existing helper (likely escapes + case-insensitive)
        return {
          $or: [{ firstName: r }, { lastName: r }, { email: r }, { employeeNumber: r }],
        };
      });

      // Require every token to match at least one of the fields
      filter.$and = filter.$and ? [...filter.$and, ...tokenAndClauses] : tokenAndClauses;
    }

    // Default: ignore terminated onboardings unless explicitly requested
    const includeTerminated = (statuses?.includes(EOnboardingStatus.Terminated) ?? false) || statusGroupRaw === "terminated";

    if (statuses && statuses.length > 0) {
      filter.status = { $in: statuses };
    } else if (!includeTerminated) {
      filter.status = { $ne: EOnboardingStatus.Terminated };
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
        filter.$and = filter.$and ? [...filter.$and, missingEmployeeNumberOr] : [missingEmployeeNumberOr];
      }
    }

    if (isCompleted !== null) {
      filter.isCompleted = isCompleted;
    }

    if (fromDate || toDate) {
      const field = dateFieldMap[dateField];
      filter[field] = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }

    // ── Query DB
    const total = await OnboardingModel.countDocuments(filter);
    const docs = (await OnboardingModel.find(filter)
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as TOnboarding[];

    const items = docs.map((d) => mapOnboardingToListItem(d, baseUrl));

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
/* POST /api/v1/admin/onboardings                                              */
/*                                                                            */
/* HR/Admin-only endpoint to create a new onboarding record and send the       */
/* initial employee email for either:                                          */
/*  - DIGITAL onboarding: generates an expiring invite token (hashed in DB)    */
/*    and emails a secure link to the employee.                                */
/*  - MANUAL onboarding: creates a record and emails the blank country-specific*/
/*    onboarding PDF template to the employee with instructions.               */
/*                                                                            */
/* Request body (JSON):                                                       */
/*  {                                                                          */
/*    subsidiary: "IN"|"CA"|"US",                                              */
/*    method: "digital"|"manual",                                              */
/*    firstName: string,                                                      */
/*    lastName: string,                                                       */
/*    email: string                                                           */
/*  }                                                                          */
/*                                                                            */
/* Current constraint:                                                        */
/*  - Only INDIA is supported right now; other subsidiaries return 400.        */
/*                                                                            */
/* Behavior:                                                                   */
/*  - Rejects if an active onboarding already exists for (subsidiary,email)    */
/*    where status != Terminated (409).                                        */
/*  - Creates the onboarding with initial status:                               */
/*      DIGITAL -> InviteGenerated                                             */
/*      MANUAL  -> ManualPDFSent                                              */
/*  - DIGITAL only:                                                           */
/*      - Generates a random raw invite token                                  */
/*      - Stores only token hash in DB                                         */
/*      - Sends email containing the raw invite token/link                     */
/*  - MANUAL only:                                                            */
/*      - Reads the blank PDF template from assets and attaches it to email     */
/*                                                                            */
/* Reliability / rollback:                                                    */
/*  - If email sending fails (or PDF read fails for manual), the created        */
/*    onboarding is deleted (best-effort rollback) and the request fails.      */
/*                                                                            */
/* Response (201):                                                            */
/*  {                                                                          */
/*    onboarding: <onboarding object>                                          */
/*  }                                                                          */
/*  Note: onboarding is returned via toObject({ virtuals: true, getters: true })*/
/*                                                                            */
/* Error cases:                                                               */
/*  - 400: missing fields / unsupported subsidiary / invalid method            */
/*  - 401/403: not authorized                                                  */
/*  - 409: duplicate active onboarding (same email + subsidiary)               */
/*  - 500: unexpected failures (DB, email provider, file read, etc.)           */
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

    /* ----------------- Prevent duplicate onboardings ----------------- */
    const existing = await OnboardingModel.findOne({
      subsidiary,
      email,
    }).lean();

    if (existing) {
      return errorResponse(409, "An onboarding already exists for this email in this subsidiary");
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
          message: `Digital onboarding created and invitation email sent by ${user.name}.`,
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
        const pdfPath = `${process.cwd()}/src/lib/assets/pdfs/npt-india-application-form.pdf`;
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
          message: `Manual onboarding created and PDF instructions email sent by ${user.name}.`,
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
      onboarding: onboarding.toObject({ virtuals: true, getters: true }),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
