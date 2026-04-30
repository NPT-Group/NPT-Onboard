import { NextRequest } from "next/server";
import connectDB from "@/lib/utils/connectDB";
import { guard } from "@/lib/utils/auth/authUtils";
import { hashPassword, isStrongEnoughPassword, normalizeAdminEmail } from "@/lib/utils/auth/password";
import { parseJsonBody } from "@/lib/utils/reqParser";
import { errorResponse, successResponse } from "@/lib/utils/apiResponse";
import { AppError } from "@/types/api.types";
import { isAdminEmail } from "@/config/adminAuth";
import { AdminUserModel } from "@/mongoose/models/AdminUser";

type SetAdminCredentialsBody = {
  email?: string;
  name?: string;
  password?: string;
};

export const POST = async (req: NextRequest) => {
  try {
    await connectDB();
    const currentAdmin = await guard();

    const body = await parseJsonBody<SetAdminCredentialsBody>(req);
    const email = normalizeAdminEmail(body.email ?? "");
    const currentAdminEmail = normalizeAdminEmail(currentAdmin.email);
    const name = (body.name ?? "").trim();
    const password = body.password ?? "";

    if (!email || !name || !password) {
      throw new AppError(400, "Email, name, and password are required");
    }

    if (!isAdminEmail(email)) {
      throw new AppError(403, "This email is not in the admin allowlist");
    }

    if (email !== currentAdminEmail) {
      throw new AppError(403, "You can only create or update credentials for your own account");
    }

    if (!isStrongEnoughPassword(password)) {
      throw new AppError(400, "Password must be at least 12 characters long");
    }

    const passwordHash = await hashPassword(password);
    const passwordUpdatedAt = new Date();

    const adminUser = await AdminUserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          name,
          passwordHash,
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordUpdatedAt,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return successResponse(200, "Admin credentials saved", {
      adminUser: {
        id: adminUser._id.toString(),
        email: adminUser.email,
        name: adminUser.name,
        isActive: adminUser.isActive,
        passwordUpdatedAt: adminUser.passwordUpdatedAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
};
