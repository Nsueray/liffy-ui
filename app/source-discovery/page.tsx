"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SourceDiscoveryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mining?tab=discover");
  }, [router]);
  return null;
}
