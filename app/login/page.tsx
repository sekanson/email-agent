"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { loginWithGoogle, isLoading, isGISReady } = useGoogleAuth({
    onLoginSuccess: async () => {
      // Redirect to dashboard after successful login
      router.push("/dashboard");
    },
    onError: (err) => {
      console.error("Login error:", err);
      setError(err.message || "Login failed. Please try again.");
    },
  });

  const handleGoogleSignIn = () => {
    setError(null);
    loginWithGoogle();
  };

  return (
    <div className="flex min-h-screen">
      {/* LEFT SIDE - Visual/Branding (hidden on mobile) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 lg:flex lg:w-1/2">
        {/* Zeno logo top left */}
        <div className="absolute left-8 top-8 z-10">
          <Image
            src="/logo.svg"
            alt="Zeno"
            width={480}
            height={280}
            className="h-28 w-auto object-contain"
          />
        </div>

        {/* Abstract visual - floating email/label cards */}
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="relative h-96 w-full max-w-md">
            {/* Floating label cards at different positions */}
            <div className="animate-float absolute left-0 top-0 transform rounded-xl bg-white/90 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <span className="font-medium text-zinc-800">Respond</span>
              </div>
            </div>

            <div className="animate-float-delayed absolute right-0 top-20 transform rounded-xl bg-white/90 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-400" />
                <span className="font-medium text-zinc-800">Calendar</span>
              </div>
            </div>

            <div className="animate-float-slow absolute left-10 top-40 transform rounded-xl bg-white/90 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="font-medium text-zinc-800">Complete</span>
              </div>
            </div>

            <div className="animate-float-delayed absolute right-8 top-56 transform rounded-xl bg-white/90 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-orange-400" />
                <span className="font-medium text-zinc-800">Update</span>
              </div>
            </div>

            {/* Testimonial card */}
            <div className="absolute -bottom-4 left-1/2 max-w-sm -translate-x-1/2 transform rounded-2xl bg-white p-6 shadow-2xl">
              <p className="mb-4 text-sm text-zinc-700">
                <span className="text-lg">&ldquo;</span>
                Zeno&apos;s Email Agent is a gamechanger to start my day. My inbox is
                finally under control.
                <span className="text-lg">&rdquo;</span>
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400" />
                <span className="text-sm font-medium text-zinc-800">Zeno User</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Login */}
      <div className="flex flex-1 items-center justify-center bg-black p-8">
        <div className="w-full max-w-md">
          {/* Logo for mobile (shows when left panel hidden) */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Image
              src="/logo.svg"
              alt="Zeno"
              width={480}
              height={280}
              className="h-36 w-auto object-contain"
            />
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-white">Get started</h1>
            <p className="text-zinc-500">Your AI-powered email assistant</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || !isGISReady}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-medium text-zinc-800 shadow-md shadow-white/5 transition-all duration-200 hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="h-5 w-5 animate-spin text-zinc-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-zinc-500">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-blue-400 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-blue-400 hover:underline">
              Privacy Policy
            </Link>
          </p>

          {/* Footer */}
          <footer className="mt-12 text-center text-sm text-zinc-500">
            <div className="flex justify-center gap-4">
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <span>•</span>
              <a href="mailto:support@xix3d.com" className="hover:text-white transition-colors">
                Contact
              </a>
            </div>
            <p className="mt-4">&copy; 2026 xix3D Inc. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
