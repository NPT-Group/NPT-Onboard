// src/app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  // For now, we treat / as an HR entry point.
  redirect("/hr/login");
}
