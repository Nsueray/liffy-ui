"use client";

import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function Page() {
  useAuthGuard();

  return (
    <div className="space-y-2">
      <h2 className="text-3xl font-bold">Prospects</h2>
      <p className="text-sm text-muted-foreground">
        Leads that replied or showed strong interest will appear here.
      </p>
    </div>
  )
}
