"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const email = searchParams.get("email");

    if (email) {
      // Store email in localStorage
      localStorage.setItem("userEmail", email);
      // Redirect to dashboard
      router.push("/dashboard");
    } else {
      // No email, redirect to home
      router.push("/");
    }
  }, [searchParams, router]);

  return (
    <div className="text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
      <p className="mt-4 text-gray-600 dark:text-gray-400">
        Signing you in...
      </p>
    </div>
  );
}

export default function AuthSuccess() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Suspense
        fallback={
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        }
      >
        <AuthSuccessContent />
      </Suspense>
    </div>
  );
}
