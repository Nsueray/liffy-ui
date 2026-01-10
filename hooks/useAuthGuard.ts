"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useAuthGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/login") return;

    const timer = window.setTimeout(() => {
      const token = localStorage.getItem("liffy_token");

      if (!token) {
        window.location.href = "/login";
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname]);
}
