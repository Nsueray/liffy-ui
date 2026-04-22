"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  status: string;
  campaign_type?: string;
  template_id: string;
  template_name?: string;
  template_subject?: string;
  list_id?: string | null;
  sender_id?: string | null;
  recipient_count?: number | null;
  scheduled_at?: string | null;
  verification_mode?: string;
  created_at: string;
  creator_name?: string | null;
}

interface ResolveStats {
  total_in_list: number;
  excluded_invalid: number;
  excluded_risky: number;
  excluded_unverified: number;
  excluded_unsubscribed: number;
  eligible: number;
  inserted: number;
}

interface EmailTemplate { id: string; name: string; subject: string; }
interface EmailList { id: string; name: string; total_leads: number; }
interface SenderIdentity { id: string; name: string; email: string; is_active: boolean; }

export default function CampaignsPage() {
  useAuthGuard();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [senders, setSenders] = useState<SenderIdentity[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Resolve Modal States
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Campaign | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveMode, setResolveMode] = useState<string>("exclude_invalid");
  const [resolveStats, setResolveStats] = useState<ResolveStats | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Schedule Modal States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<Campaign | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleDatetime, setScheduleDatetime] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Form Inputs
  const [newCampaignName, setNewCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState<"single" | "sequence">("single");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedSenderId, setSelectedSenderId] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";
  
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    try {
      // Fetch Campaigns
      const campRes = await fetch(`${apiBase}/api/campaigns`, { headers: { Authorization: `Bearer ${token}` } });
      if (campRes.ok) setCampaigns(await campRes.json());

      // Fetch Templates
      const tplRes = await fetch(`${apiBase}/api/email-templates`, { headers: { Authorization: `Bearer ${token}` } });
      if (tplRes.ok) {
        const data = await tplRes.json();
        setTemplates(data.templates || (Array.isArray(data) ? data : []));
      }

      // Fetch Lists
      const listRes = await fetch(`${apiBase}/api/lists`, { headers: { Authorization: `Bearer ${token}` } });
      if (listRes.ok) {
        const data = await listRes.json();
        setLists(data.lists || []);
      }

      // Fetch Senders
      const senderRes = await fetch(`${apiBase}/api/senders`, { headers: { Authorization: `Bearer ${token}` } });
      if (senderRes.ok) {
        const data = await senderRes.json();
        setSenders(data.identities || (Array.isArray(data) ? data : []));
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- ACTIONS ---
  async function handleAction(campaignId: string, action: "start" | "pause" | "resume") {
    const token = getToken();
    if (!token) return;

    setActionLoading(campaignId);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} campaign`);

      if (data.campaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, ...data.campaign } : c)));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  // --- SCHEDULE ---
  function openScheduleModal(campaign: Campaign) {
    setScheduleTarget(campaign);
    setScheduleError(null);
    // Default to 1 hour from now
    const d = new Date(Date.now() + 3600000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setScheduleDatetime(d.toISOString().slice(0, 16));
    setShowScheduleModal(true);
  }

  async function handleSchedule() {
    if (!scheduleTarget || !scheduleDatetime) return;
    const token = getToken();
    if (!token) return;

    const scheduledAt = new Date(scheduleDatetime);
    if (scheduledAt <= new Date()) {
      setScheduleError("Scheduled time must be in the future");
      return;
    }

    setScheduleLoading(true);
    setScheduleError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${scheduleTarget.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scheduled_at: scheduledAt.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule campaign");

      if (data.campaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === scheduleTarget.id ? { ...c, ...data.campaign } : c)));
      }
      setShowScheduleModal(false);
      setScheduleTarget(null);
    } catch (err: any) {
      setScheduleError(err.message);
    } finally {
      setScheduleLoading(false);
    }
  }

  // --- RESOLVE ---
  function openResolveModal(campaign: Campaign) {
    setResolveTarget(campaign);
    setResolveMode(campaign.verification_mode || "exclude_invalid");
    setResolveStats(null);
    setResolveError(null);
    setShowResolveModal(true);
  }

  async function handleResolve() {
    if (!resolveTarget) return;
    const token = getToken();
    if (!token) return;

    setResolveLoading(true);
    setResolveError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${resolveTarget.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verification_mode: resolveMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve campaign");

      setResolveStats(data.stats || null);

      if (data.campaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === resolveTarget.id ? { ...c, ...data.campaign } : c)));
      }
    } catch (err: any) {
      setResolveError(err.message);
    } finally {
      setResolveLoading(false);
    }
  }

  function closeResolveModal() {
    setShowResolveModal(false);
    setResolveTarget(null);
    setResolveStats(null);
    setResolveError(null);
  }

  // --- DELETE ---
  function openDeleteModal(campaign: Campaign) {
    setDeleteTarget(campaign);
    setShowDeleteModal(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    
    const token = getToken();
    if (!token) return;

    setDeleteLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to delete campaign");

      // Remove from list
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (!newCampaignName.trim()) { setCreateError("Name is required"); return; }
    if (campaignType === "single" && !selectedTemplateId) { setCreateError("Template is required"); return; }
    if (!selectedListId) { setCreateError("List is required"); return; }
    if (!selectedSenderId) { setCreateError("Sender is required"); return; }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await fetch(`${apiBase}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          template_id: campaignType === "single" ? selectedTemplateId : undefined,
          list_id: selectedListId,
          sender_id: selectedSenderId,
          campaign_type: campaignType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");

      setCampaigns((prev) => [data, ...prev]);
      setShowCreateModal(false);

      // Reset Form
      setNewCampaignName("");
      setCampaignType("single");
      setSelectedTemplateId("");
      setSelectedListId("");
      setSelectedSenderId("");
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  // --- HELPERS ---
  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function getStatusBadge(status: string) {
    const styles: any = {
      draft: "bg-gray-100 text-gray-800",
      ready: "bg-blue-100 text-blue-800",
      scheduled: "bg-indigo-100 text-indigo-800",
      sending: "bg-green-100 text-green-800",
      sequencing: "bg-indigo-100 text-indigo-800",
      paused: "bg-orange-100 text-orange-800",
      completed: "bg-purple-100 text-purple-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  }

  // Can delete if not sending/sequencing
  function canDelete(status: string) {
    return status !== 'sending' && status !== 'sequencing';
  }

  if (loading) return <div className="p-8">Loading campaigns...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Manage your email outreach.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/campaigns/unsubscribes" className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
            Unsubscribes
          </Link>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Create Campaign
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {campaigns.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No campaigns yet.</td></tr>
            ) : (
                campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <Link href={`/campaigns/${c.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {c.name}
                        </Link>
                        {c.campaign_type === "sequence" && <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700 font-semibold">SEQ</span>}
                      </td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full font-semibold ${getStatusBadge(c.status)}`}>{c.status}</span></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.recipient_count ?? "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.template_name || c.template_subject || "Unknown"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.scheduled_at ? formatDate(c.scheduled_at) : "-"}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{c.creator_name || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-4 text-right text-sm">
                        <div className="flex justify-end gap-2">
                            {/* DRAFT -> RESOLVE */}
                            {c.status === 'draft' && (
                                <button
                                    onClick={() => openResolveModal(c)}
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    Resolve Audience
                                </button>
                            )}
                            
                            {/* READY -> SEND NOW or SCHEDULE */}
                            {c.status === 'ready' && (
                                <>
                                  <button
                                      onClick={() => handleAction(c.id, 'start')}
                                      disabled={actionLoading === c.id}
                                      className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                  >
                                      {actionLoading === c.id ? "Starting..." : "Send Now"}
                                  </button>
                                  <button
                                      onClick={() => openScheduleModal(c)}
                                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                                  >
                                      Schedule
                                  </button>
                                </>
                            )}

                            {/* SCHEDULED -> SEND NOW (cancel schedule) */}
                            {c.status === 'scheduled' && (
                                <button
                                    onClick={() => handleAction(c.id, 'start')}
                                    disabled={actionLoading === c.id}
                                    className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                >
                                    {actionLoading === c.id ? "Starting..." : "Send Now"}
                                </button>
                            )}

                            {/* SENDING -> PAUSE */}
                            {c.status === 'sending' && (
                                <button
                                    onClick={() => handleAction(c.id, 'pause')}
                                    disabled={actionLoading === c.id}
                                    className="text-orange-600 hover:text-orange-800 font-medium disabled:opacity-50"
                                >
                                    Pause
                                </button>
                            )}

                            {/* PAUSED -> RESUME */}
                            {c.status === 'paused' && (
                                <button
                                    onClick={() => handleAction(c.id, 'resume')}
                                    disabled={actionLoading === c.id}
                                    className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                >
                                    Resume
                                </button>
                            )}

                            {/* DELETE BUTTON - Show for all except 'sending' */}
                            {canDelete(c.status) && (
                                <button
                                    onClick={() => openDeleteModal(c)}
                                    className="text-red-600 hover:text-red-800 font-medium"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                      </td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Create New Campaign</h3>
            {createError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{createError}</div>}
            
            <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Campaign Name</label>
                    <input type="text" className="w-full border rounded px-3 py-2"
                        value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} placeholder="e.g. Q1 Outreach" />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Campaign Type</label>
                    <div className="flex gap-3">
                      <label className={`flex-1 border rounded-lg p-3 cursor-pointer text-center text-sm ${campaignType === "single" ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        <input type="radio" name="campaignType" value="single" checked={campaignType === "single"} onChange={() => setCampaignType("single")} className="sr-only" />
                        Single Email
                      </label>
                      <label className={`flex-1 border rounded-lg p-3 cursor-pointer text-center text-sm ${campaignType === "sequence" ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        <input type="radio" name="campaignType" value="sequence" checked={campaignType === "sequence"} onChange={() => setCampaignType("sequence")} className="sr-only" />
                        Email Sequence
                      </label>
                    </div>
                    {campaignType === "sequence" && <p className="text-xs text-gray-500 mt-1">Multi-touch sequence — configure steps after creating the campaign.</p>}
                </div>

                {campaignType === "single" && (
                <div>
                    <label className="block text-sm font-medium mb-1">Select Template</label>
                    <select className="w-full border rounded px-3 py-2"
                        value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                        <option value="">-- Choose Template --</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                )}

                <div>
                    <label className="block text-sm font-medium mb-1">Select List (Audience)</label>
                    <select className="w-full border rounded px-3 py-2" 
                        value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
                        <option value="">-- Choose List --</option>
                        {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.total_leads} leads)</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Select Sender (From)</label>
                    <select className="w-full border rounded px-3 py-2" 
                        value={selectedSenderId} onChange={e => setSelectedSenderId(e.target.value)}>
                        <option value="">-- Choose Sender --</option>
                        {senders.map(s => <option key={s.id} value={s.id}>{s.email}</option>)}
                    </select>
                    {senders.length === 0 && <p className="text-xs text-red-500 mt-1">No senders found. Please add a sender in Settings.</p>}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                    <button type="submit" disabled={createLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        {createLoading ? "Creating..." : "Create Draft"}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE MODAL */}
      {showResolveModal && resolveTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Resolve Audience</h3>
            <p className="text-sm text-gray-500 mb-4">
              Configure verification filtering for <strong>{resolveTarget.name}</strong>.
            </p>

            {resolveError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{resolveError}</div>}

            {!resolveStats ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Verification Mode</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={resolveMode}
                    onChange={e => setResolveMode(e.target.value)}
                    disabled={resolveLoading}
                  >
                    <option value="exclude_invalid">Send to all (exclude invalid)</option>
                    <option value="verified_only">Send only to verified emails</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {resolveMode === "verified_only"
                      ? "Only emails with 'valid' or 'catch-all' verification status will be included."
                      : "All emails except 'invalid' will be included. Unverified emails are sent."}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeResolveModal}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    disabled={resolveLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolve}
                    disabled={resolveLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {resolveLoading ? "Resolving..." : "Resolve"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total in list</span>
                    <span className="font-medium">{resolveStats.total_in_list}</span>
                  </div>
                  {resolveStats.excluded_invalid > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Excluded (invalid)</span>
                      <span className="font-medium text-red-600">-{resolveStats.excluded_invalid}</span>
                    </div>
                  )}
                  {resolveStats.excluded_risky > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600">Excluded (risky)</span>
                      <span className="font-medium text-orange-600">-{resolveStats.excluded_risky}</span>
                    </div>
                  )}
                  {resolveStats.excluded_unverified > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Excluded (unverified)</span>
                      <span className="font-medium text-gray-500">-{resolveStats.excluded_unverified}</span>
                    </div>
                  )}
                  {resolveStats.excluded_unsubscribed > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-600">Excluded (unsubscribed)</span>
                      <span className="font-medium text-yellow-600">-{resolveStats.excluded_unsubscribed}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t font-semibold">
                    <span className="text-green-700">Recipients added</span>
                    <span className="text-green-700">{resolveStats.inserted}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={closeResolveModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-2">Delete Campaign</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? 
              This will also remove all recipient data. This action cannot be undone.
            </p>
            
            {error && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{error}</div>}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button 
                type="button" 
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} 
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleteLoading} 
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SCHEDULE MODAL */}
      {showScheduleModal && scheduleTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-1">Schedule Campaign</h3>
            <p className="text-sm text-gray-500 mb-4">
              Set send time for <strong>{scheduleTarget.name}</strong>
            </p>

            {scheduleError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{scheduleError}</div>}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Send Date & Time</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={scheduleDatetime}
                onChange={e => setScheduleDatetime(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => { setShowScheduleModal(false); setScheduleTarget(null); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                disabled={scheduleLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={scheduleLoading || !scheduleDatetime}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {scheduleLoading ? "Scheduling..." : "Schedule Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
