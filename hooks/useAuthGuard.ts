"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Login sayfasında guard çalışmaz
    if (pathname === "/login") return;

    // İlk render yarışını engelle
    setTimeout(() => {
      const token = localStorage.getItem("liffy_token");
      if (!token) {
        window.location.href = "/login";
      }
    }, 0);
  }, [router, pathname]);
}