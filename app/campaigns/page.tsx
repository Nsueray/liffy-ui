"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";

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
  
  // Form Inputs
  const [newCampaignName, setNewCampaignName] = useState("");
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
  async function handleAction(campaignId: string, action: "resolve" | "start" | "pause" | "resume") {
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
    if (!selectedTemplateId) { setCreateError("Template is required"); return; }
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
          template_id: selectedTemplateId,
          list_id: selectedListId,
          sender_id: selectedSenderId
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");

      setCampaigns((prev) => [data, ...prev]);
      setShowCreateModal(false);
      
      // Reset Form
      setNewCampaignName("");
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
      sending: "bg-green-100 text-green-800",
      paused: "bg-orange-100 text-orange-800",
      completed: "bg-purple-100 text-purple-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  }

  // Can delete if not sending
  function canDelete(status: string) {
    return status !== 'sending';
  }

  if (loading) return <div className="p-8">Loading campaigns...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Manage your email outreach.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Create Campaign
        </button>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {campaigns.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No campaigns yet.</td></tr>
            ) : (
                campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <Link href={`/campaigns/${c.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full font-semibold ${getStatusBadge(c.status)}`}>{c.status}</span></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.recipient_count ?? "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.template_name || c.template_subject || "Unknown"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-4 text-right text-sm">
                        <div className="flex justify-end gap-2">
                            {/* DRAFT -> RESOLVE */}
                            {c.status === 'draft' && (
                                <button
                                    onClick={() => handleAction(c.id, 'resolve')}
                                    disabled={actionLoading === c.id}
                                    className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                                >
                                    {actionLoading === c.id ? "Resolving..." : "Resolve Audience"}
                                </button>
                            )}
                            
                            {/* READY -> START */}
                            {c.status === 'ready' && (
                                <button
                                    onClick={() => handleAction(c.id, 'start')}
                                    disabled={actionLoading === c.id}
                                    className="text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                                >
                                    {actionLoading === c.id ? "Starting..." : "Start Campaign"}
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
                    <label className="block text-sm font-medium mb-1">Select Template</label>
                    <select className="w-full border rounded px-3 py-2" 
                        value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                        <option value="">-- Choose Template --</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>

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
    </div>
  );
}
