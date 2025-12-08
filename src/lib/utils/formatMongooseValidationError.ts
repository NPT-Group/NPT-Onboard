import mongoose from "mongoose";

export default function formatMongooseValidationError(err: unknown): string {
  if (err instanceof mongoose.Error.ValidationError) {
    return Object.entries(err.errors)
      .map(([path, error]) => {
        // For CastError: override message
        if (error.name === "CastError") {
          return `Invalid format for '${path}': ${error.value}`;
        }
        return error.message;
      })
      .join("; ");
  }
  return "An unknown validation error occurred.";
}
