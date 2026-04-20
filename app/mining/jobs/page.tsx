"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MiningJobsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mining?tab=jobs");
  }, [router]);
  return null;
}
