"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const email = searchParams.get("email");
    const name = searchParams.get("name");
    const picture = searchParams.get("picture");

    if (email) {
      // Store user info in localStorage
      localStorage.setItem("userEmail", email);
      if (name) localStorage.setItem("userName", name);
      if (picture) localStorage.setItem("userPicture", picture);
      // Redirect to dashboard
      router.push("/dashboard");
    } else {
      // No email, redirect to home
      router.push("/");
    }
  }, [searchParams, router]);

  return (
    <div className="text-center">
      <Image
        src="/logo.png"
        alt="Zeno"
        width={64}
        height={64}
        className="mx-auto mb-8 object-contain"
      />
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--accent)]" />
      <p className="mt-4 text-[var(--text-muted)]">Signing you in...</p>
    </div>
  );
}

export default function AuthSuccess() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      {/* Gradient overlay */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5" />

      <Suspense
        fallback={
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--accent)]" />
            <p className="mt-4 text-[var(--text-muted)]">Loading...</p>
          </div>
        }
      >
        <AuthSuccessContent />
      </Suspense>
    </div>
  );
}
