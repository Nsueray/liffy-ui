"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewMiningJobRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mining?tab=jobs");
  }, [router]);
  return null;
}
