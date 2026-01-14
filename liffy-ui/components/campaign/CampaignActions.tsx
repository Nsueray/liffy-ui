"use client";

import { useState } from "react";

interface Campaign {
  id: string;
  status: string;
  list_id?: string | null;
  sender_id?: string | null;
}

interface CampaignActionsProps {
  campaign: Campaign;
  onUpdate: (updatedCampaign: Campaign) => void;
}

export function CampaignActions({ campaign, onUpdate }: CampaignActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";

  async function handleAction(action: "resolve" | "pause" | "resume") {
    const token = typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaign.id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action}`);
      }

      if (data.campaign) {
        onUpdate(data.campaign);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to ${action}`;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const canResolve = campaign.status === "draft" && campaign.list_id && campaign.sender_id;
  const showResolve = campaign.status === "draft";
  const showPause = campaign.status === "sending";
  const showResume = campaign.status === "paused";

  return (
    <div className="flex items-center gap-2">
      {showResolve && (
        <button
          onClick={() => handleAction("resolve")}
          disabled={loading || !canResolve}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canResolve ? "Set list and sender first" : "Resolve recipients"}
        >
          {loading ? "..." : "Resolve"}
        </button>
      )}

      {showPause && (
        <button
          onClick={() => handleAction("pause")}
          disabled={loading}
          className="px-3 py-1 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? "..." : "Pause"}
        </button>
      )}

      {showResume && (
        <button
          onClick={() => handleAction("resume")}
          disabled={loading}
          className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "..." : "Resume"}
        </button>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
