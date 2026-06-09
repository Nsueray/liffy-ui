"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { loginUrlWithReturnTo } from "@/lib/authRedirect";

// Read the JWT `exp` claim (seconds) via base64 decode. No signature check.
// Returns null if the token is malformed or carries no numeric exp.
function jwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload?.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

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
        window.location.href = loginUrlWithReturnTo();
        return;
      }
      // Expire stale tokens: if exp is present and has passed, clear and re-login.
      // No exp claim → keep prior behavior (existence-only check).
      const exp = jwtExp(token);
      if (exp !== null && exp * 1000 < Date.now()) {
        localStorage.removeItem("liffy_token");
        localStorage.removeItem("liffy_user");
        window.location.href = loginUrlWithReturnTo();
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(checkToken);
    } else {
      setTimeout(checkToken, 0);
    }
  }, [pathname]);
}
