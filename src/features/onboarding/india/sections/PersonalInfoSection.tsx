"use client";

import { useEffect } from "react";
import { useFormContext, useWatch, type FieldPath } from "react-hook-form";

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
    "personalInfo.reference1Name",
    "personalInfo.reference1PhoneNumber",
    "personalInfo.reference2Name",
    "personalInfo.reference2PhoneNumber",
    "personalInfo.hasConsentToContactReferencesOrEmergencyContact",
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
    control,
    formState: { errors },
  } = useFormContext<IndiaOnboardingFormInput>();

  // Sync firstName/lastName/email from onboarding meta so they always match.
  useEffect(() => {
    // Guard against null/undefined onboarding
    if (!onboarding) return;
    setValue("personalInfo.firstName", onboarding.firstName ?? "");
    setValue("personalInfo.lastName", onboarding.lastName ?? "");
    setValue("personalInfo.email", onboarding.email ?? "");
  }, [onboarding, setValue]);

  const personalErrors = errors.personalInfo ?? {};
  
  // Use useWatch to subscribe to gender value changes - this triggers re-renders when value changes
  // This is the EXACT same pattern used in EmploymentSection for hasPreviousEmployment toggle
  const genderValue = useWatch({
    control,
    name: "personalInfo.gender",
  }) as EGender | undefined;

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
            {[
              { value: EGender.MALE, label: "Male" },
              { value: EGender.FEMALE, label: "Female" },
            ].map((opt, idx) => {
              // Direct comparison - EXACT same pattern as EmploymentSection
              const isActive = genderValue === opt.value;

              const handleClick = () => {
                setValue("personalInfo.gender", opt.value, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              };

              return (
                <button
                  key={opt.label}
                  type="button"
                  disabled={isReadOnly}
                  onClick={handleClick}
                  className={cn(
                    "flex-1 min-w-0 px-4 py-2 text-sm font-medium transition-all",
                    idx > 0 && "border-l border-slate-300",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-800 hover:bg-slate-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/70",
                    isReadOnly && "cursor-not-allowed opacity-75"
                  )}
                >
                  {opt.label}
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
            label="PIN code"
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

        <div className="pt-2">
          <h2 className="text-sm font-semibold text-slate-900">References</h2>
          <p className="mt-1 text-xs text-slate-600">
            Please provide two references we may contact.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFTextInput
            name="personalInfo.reference1Name"
            label="Reference #1 name"
            disabled={isReadOnly}
          />
          <RHFPhoneInput
            name="personalInfo.reference1PhoneNumber"
            label="Reference #1 phone number"
            disabled={isReadOnly}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFTextInput
            name="personalInfo.reference2Name"
            label="Reference #2 name"
            disabled={isReadOnly}
          />
          <RHFPhoneInput
            name="personalInfo.reference2PhoneNumber"
            label="Reference #2 phone number"
            disabled={isReadOnly}
          />
        </div>

        <div className="flex items-center pt-2">
          <RHFCheckbox
            name="personalInfo.hasConsentToContactReferencesOrEmergencyContact"
            label="I confirm that I have permission for NPT to contact my references and/or emergency contact."
            disabled={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
}
