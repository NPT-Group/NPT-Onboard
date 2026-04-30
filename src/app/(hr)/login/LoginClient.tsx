"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginClient({
  callbackUrl,
  errorMsg,
}: {
  callbackUrl?: string;
  errorMsg?: string;
}) {
  const router = useRouter();
  const { status } = useSession();

  const safeCallbackUrl =
    callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace(safeCallbackUrl);
  }, [status, router, safeCallbackUrl]);

  async function handleCredentialsSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCredentialsError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: safeCallbackUrl,
        redirect: false,
      });

      if (!result || result.error) {
        setCredentialsError("Invalid email or password.");
        return;
      }

      router.replace(result.url ?? safeCallbackUrl);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4">
      <div className="mb-6">
        <Image src="/assets/logos/NPTlogo.png" alt="SSP Logo" width={180} height={140} priority />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1 text-center">Welcome to NPT Onboard</h1>
      <p className="text-sm text-gray-600 mb-4 text-center">Employee hiring system</p>

      {errorMsg && <p className="mb-4 text-sm text-red-600 text-center max-w-md">{errorMsg}</p>}

      <form
        className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6"
        onSubmit={handleCredentialsSignIn}
      >
        {/* Email */}
        <div>
          <label htmlFor="email" className="text-sm font-medium text-gray-700 mb-1 block">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            placeholder="hr@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="text-sm font-medium text-gray-700 mb-1 block">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md bg-white"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-2 flex items-center text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {credentialsError && (
          <p className="text-sm text-red-600 text-center">{credentialsError}</p>
        )}

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-md transition duration-200 cursor-pointer"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
          <p className="mt-2 text-xs text-gray-500 text-center">
            Your browser or password manager can save this login for faster access.
          </p>
        </div>

        {/* Microsoft Login */}
        <div className="space-y-2">
          <p className="text-center font-medium text-sm text-gray-600">Or use company login</p>
          <button
            type="button"
            onClick={() => signIn("azure-ad", { callbackUrl: safeCallbackUrl })}
            className="w-full bg-black hover:bg-neutral-800 text-white font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
          >
            <Image src="/assets/logos/microsoft-logo.png" alt="Microsoft Logo" width={20} height={20} />
            <span>Sign In With Microsoft</span>
          </button>
        </div>
      </form>

      <footer className="mt-10 text-xs text-gray-500 text-center">© NPT Group {currentYear}</footer>
    </div>
  );
}
