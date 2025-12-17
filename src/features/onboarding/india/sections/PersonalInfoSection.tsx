"use client";

import { useEffect, useState } from "react";
import { useFormContext, type FieldPath } from "react-hook-form";

import type { IndiaOnboardingFormInput } from "../indiaFormSchema";
import type { TOnboardingContext } from "@/types/onboarding.types";
import { EGender } from "@/types/onboarding.types";

import { RHFTextInput } from "../../common/RHFTextInput";
import { RHFCheckbox } from "../../common/RHFCheckbox";
import { RHFPhoneInput } from "../../common/RHFPhoneInput";

import { FormField } from "../../common/FormField";
import { cn } from "@/lib/utils/cn";

/**
 * Field paths for this section – used for section-level validation.
 */
export const PERSONAL_INFO_FIELD_PATHS: FieldPath<IndiaOnboardingFormInput>[] =
  [
    "personalInfo.firstName",
    "personalInfo.lastName",
    "personalInfo.email",
    "personalInfo.gender",
    "personalInfo.dateOfBirth",
    "personalInfo.canProvideProofOfAge",
    "personalInfo.residentialAddress.addressLine1",
    "personalInfo.residentialAddress.city",
    "personalInfo.residentialAddress.state",
    "personalInfo.residentialAddress.postalCode",
    "personalInfo.residentialAddress.fromDate",
    "personalInfo.residentialAddress.toDate",
    "personalInfo.phoneMobile",
    "personalInfo.emergencyContactName",
    "personalInfo.emergencyContactNumber",
  ];

type PersonalInfoSectionProps = {
  onboarding: TOnboardingContext;
  isReadOnly: boolean;
};

export function PersonalInfoSection({
  onboarding,
  isReadOnly,
}: PersonalInfoSectionProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<IndiaOnboardingFormInput>();

  // Sync firstName/lastName/email from onboarding meta so they always match.
  useEffect(() => {
    setValue("personalInfo.firstName", onboarding.firstName ?? "");
    setValue("personalInfo.lastName", onboarding.lastName ?? "");
    setValue("personalInfo.email", onboarding.email ?? "");
  }, [onboarding, setValue]);

  const personalErrors = errors.personalInfo ?? {};
  const genderValue = watch("personalInfo.gender");

  // Local UI state for gender pill selection (decoupled from RHF internals)
  const [localGender, setLocalGender] = useState<"male" | "female" | null>(
    null
  );

  // Initialise localGender from whatever RHF currently has stored
  useEffect(() => {
    if (!genderValue) return;
    const normalized = String(genderValue).trim().toLowerCase();

    if (normalized.includes("male")) {
      setLocalGender("male");
    } else if (normalized.includes("female")) {
      setLocalGender("female");
    }
  }, [genderValue]);

  return (
    <div className="rounded-2xl px-4 py-6 shadow-sm sm:px-6 sm:py-7">
      <header className="mb-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Personal Information
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tell us how we can reach you and where you currently live.
        </p>
      </header>

      {/* Identity – 2 per row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="First name"
          htmlFor="personalInfo.firstName"
          error={personalErrors.firstName?.message?.toString()}
        >
          <input
            type="text"
            data-field="personalInfo.firstName"
            id="personalInfo.firstName"
            readOnly
            aria-readonly="true"
            {...register("personalInfo.firstName")}
            className={cn(
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm outline-none",
              "bg-slate-100 text-slate-700",
              "read-only:cursor-not-allowed",
              "border-slate-200 focus:border-slate-400"
            )}
          />
        </FormField>

        <FormField
          label="Last name"
          htmlFor="personalInfo.lastName"
          error={personalErrors.lastName?.message?.toString()}
        >
          <input
            type="text"
            data-field="personalInfo.lastName"
            id="personalInfo.lastName"
            readOnly
            aria-readonly="true"
            {...register("personalInfo.lastName")}
            className={cn(
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm outline-none",
              "bg-slate-100 text-slate-700",
              "read-only:cursor-not-allowed",
              "border-slate-200 focus:border-slate-400"
            )}
          />
        </FormField>
      </div>

      {/* Email + Gender – 2 per row */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          label="Email address"
          htmlFor="personalInfo.email"
          error={personalErrors.email?.message?.toString()}
        >
          <input
            type="email"
            data-field="personalInfo.email"
            id="personalInfo.email"
            readOnly
            aria-readonly="true"
            {...register("personalInfo.email")}
            className={cn(
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm outline-none",
              "bg-slate-100 text-slate-700",
              "read-only:cursor-not-allowed",
              "border-slate-200 focus:border-slate-400"
            )}
          />
        </FormField>

        <FormField
          label="Gender"
          htmlFor="personalInfo.gender"
          error={personalErrors.gender?.message?.toString()}
        >
          <input
            type="hidden"
            {...register("personalInfo.gender")}
          />

          <div
            data-field="personalInfo.gender"
            className={cn(
              "mt-1 inline-flex w-full overflow-hidden rounded-full border",
              "border-slate-300"
            )}
          >
            {(["male", "female"] as const).map((option, idx) => {
              const isSelected = localGender === option;

              const handleClick = () => {
                setLocalGender(option);
                const backendValue =
                  option === "male" ? EGender.MALE : EGender.FEMALE;

                setValue("personalInfo.gender", backendValue, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              };

              return (
                <button
                  key={option}
                  type="button"
                  disabled={isReadOnly}
                  onClick={handleClick}
                  className={cn(
                    "w-full px-4 py-2 text-sm font-medium transition-all",
                    idx > 0 && "border-l border-slate-300",
                    isSelected
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-800 hover:bg-slate-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/70",
                    isReadOnly && "cursor-not-allowed opacity-75"
                  )}
                >
                  {option === "male" ? "Male" : "Female"}
                </button>
              );
            })}
          </div>
        </FormField>
      </div>

      {/* Date of birth + proof-of-age checkbox – 2 per row */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <RHFTextInput
          name="personalInfo.dateOfBirth"
          label="Date of birth"
          type="date"
          disabled={isReadOnly}
        />

        <div className="flex items-center md:pt-6">
          <RHFCheckbox
            name="personalInfo.canProvideProofOfAge"
            label="I can provide valid government proof of age."
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* Address */}
      <div className="mt-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Residential address
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFTextInput
            name="personalInfo.residentialAddress.addressLine1"
            label="Address"
            disabled={isReadOnly}
          />
          <RHFTextInput
            name="personalInfo.residentialAddress.city"
            label="City"
            disabled={isReadOnly}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFTextInput
            name="personalInfo.residentialAddress.state"
            label="State / Province"
            disabled={isReadOnly}
          />
          <RHFTextInput
            name="personalInfo.residentialAddress.postalCode"
            label="Postal code"
            disabled={isReadOnly}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFTextInput
            name="personalInfo.residentialAddress.fromDate"
            label="Living at this address since"
            type="date"
            disabled={isReadOnly}
          />
          <RHFTextInput
            name="personalInfo.residentialAddress.toDate"
            label="Until"
            type="date"
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* Phones & emergency contact – 2 per row */}
      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFPhoneInput
            name="personalInfo.phoneHome"
            label="Phone (home)"
            disabled={isReadOnly}
          />
          <RHFPhoneInput
            name="personalInfo.phoneMobile"
            label="Phone (mobile)"
            disabled={isReadOnly}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFTextInput
            name="personalInfo.emergencyContactName"
            label="Emergency contact name"
            disabled={isReadOnly}
          />
          <RHFPhoneInput
            name="personalInfo.emergencyContactNumber"
            label="Emergency contact number"
            disabled={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
}
