"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Logo() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Check initial theme
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
    return () => observer.disconnect();
  }, []);

  return (
    <Image
      src={isDark ? "/logo.png" : "/logo-dark.png"}
      alt="Zeno"
      width={60}
      height={20}
      className="h-5 w-auto object-contain"
      priority
    />
  );
}
