"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";

function AuthSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check theme
    const theme = document.documentElement.getAttribute("data-theme");
    setIsDark(theme !== "light");

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme") {
          const newTheme = document.documentElement.getAttribute("data-theme");
          setIsDark(newTheme !== "light");
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

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

    return () => observer.disconnect();
  }, [searchParams, router]);

  return (
    <div className="text-center">
      <Image
        src={isDark ? "/logo.svg" : "/logo-dark.svg"}
        alt="Zeno"
        width={480}
        height={280}
        className="mx-auto mb-8 h-40 w-auto object-contain"
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
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5" />

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
