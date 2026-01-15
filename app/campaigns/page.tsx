"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";

interface Campaign {
  id: string;
  name: string;
  status: string;
  template_id: string;
  template_name?: string;
  template_subject?: string;
  list_id?: string | null;
  sender_id?: string | null;
  recipient_count?: number | null;
  scheduled_at?: string | null;
  created_at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
}

export default function CampaignsPage() {
  useAuthGuard();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";

  const getToken = () => {
    return typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;
  };

  const fetchCampaigns = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/campaigns`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch campaigns");
      }

      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load campaigns";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const fetchTemplates = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiBase}/api/email-templates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await res.json();
      setTemplates(data.templates || (Array.isArray(data) ? data : []));
    } catch (err: unknown) {
      console.error("Failed to fetch templates:", err);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
  }, [fetchCampaigns, fetchTemplates]);

  async function handleAction(campaignId: string, action: "resolve" | "pause" | "resume") {
    const token = getToken();
    if (!token) return;

    setActionLoading(campaignId);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} campaign`);
      }

      if (data.campaign) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaignId ? { ...c, ...data.campaign } : c))
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to ${action} campaign`;
      setError(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (!newCampaignName.trim()) {
      setCreateError("Campaign name is required");
      return;
    }

    if (!selectedTemplateId) {
      setCreateError("Please select a template");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          template_id: selectedTemplateId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }

      setCampaigns((prev) => [data, ...prev]);
      setShowCreateModal(false);
      setNewCampaignName("");
      setSelectedTemplateId("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create campaign";
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusBadge(status: string): string {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      ready: "bg-blue-100 text-blue-800",
      scheduled: "bg-yellow-100 text-yellow-800",
      sending: "bg-green-100 text-green-800",
      paused: "bg-orange-100 text-orange-800",
      completed: "bg-purple-100 text-purple-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Campaigns</h2>
        <p className="text-sm text-muted-foreground">Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Create and track your outbound email campaigns.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Create Campaign
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No campaigns yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipients
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {campaign.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                        campaign.status
                      )}`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {campaign.recipient_count ?? "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {campaign.template_name || campaign.template_subject || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(campaign.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {campaign.status === "draft" && (
                        <button
                          onClick={() => handleAction(campaign.id, "resolve")}
                          disabled={actionLoading === campaign.id || !campaign.list_id || !campaign.sender_id}
                          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!campaign.list_id || !campaign.sender_id ? "Set list and sender first" : "Resolve recipients"}
                        >
                          {actionLoading === campaign.id ? "..." : "Resolve"}
                        </button>
                      )}
                      {campaign.status === "sending" && (
                        <button
                          onClick={() => handleAction(campaign.id, "pause")}
                          disabled={actionLoading === campaign.id}
                          className="px-3 py-1 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50"
                        >
                          {actionLoading === campaign.id ? "..." : "Pause"}
                        </button>
                      )}
                      {campaign.status === "paused" && (
                        <button
                          onClick={() => handleAction(campaign.id, "resume")}
                          disabled={actionLoading === campaign.id}
                          className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {actionLoading === campaign.id ? "..." : "Resume"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Campaign</h3>

            {createError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCampaign}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter campaign name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name || template.subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCampaignName("");
                    setSelectedTemplateId("");
                    setCreateError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
