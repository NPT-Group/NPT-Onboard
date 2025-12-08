// src/mongoose/models/Onboarding.ts
import { model, models, type Model } from "mongoose";
import { onboardingSchema } from "../schemas/onboardingSchema";
import type { TOnboarding } from "@/types/onboarding.types";

export type TOnboardingModel = Model<TOnboarding>;

export const OnboardingModel: TOnboardingModel = (models.Onboarding as TOnboardingModel) || model<TOnboarding>("Onboarding", onboardingSchema);
