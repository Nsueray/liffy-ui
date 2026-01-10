"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getAuthHeaders } from "@/lib/auth";

export function useAuthGuard() {
  const router = useRouter();

  useEffect(() => {
    const headers = getAuthHeaders();

    if (!headers) {
      router.replace("/login");
      return;
    }
  }, [router]);
}
