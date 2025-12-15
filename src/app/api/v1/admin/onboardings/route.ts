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
/* GET /api/v1/admin/onboardings                                             */
/* Rich search, filtering, sorting, pagination                               */
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
