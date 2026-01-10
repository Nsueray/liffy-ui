"use client";

import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function Page() {
  useAuthGuard();

  return (
    <div className="space-y-2">
      <h2 className="text-3xl font-bold">Lists</h2>
      <p className="text-sm text-muted-foreground">
        Manage your lead lists and verification status here.
      </p>
    </div>
  )
}
