"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function useAuthGuard() {
  const pathname = usePathname();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/login") return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const checkToken = () => {
      const token = localStorage.getItem("liffy_token");
      if (!token) {
        window.location.href = "/login";
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(checkToken);
    } else {
      setTimeout(checkToken, 0);
    }
  }, [pathname]);
}
