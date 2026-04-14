"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";

interface SequenceStep {
  id: string;
  sequence_order: number;
  template_id: string;
  template_name: string;
  template_subject: string;
  delay_days: number;
  condition: string;
  subject_override: string | null;
  is_active: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  campaign_type?: string;
  recipient_count?: number | null;
}

interface SequenceAnalytics {
  total_recipients: number;
  status_breakdown: Record<string, number>;
  steps: Array<{
    step: number;
    template_name: string;
    template_subject: string;
    delay_days: number;
    condition: string;
    sent: number;
  }>;
  engagement: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
}

export default function SequenceBuilderPage() {
  useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [analytics, setAnalytics] = useState<SequenceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add step form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState("");
  const [newDelayDays, setNewDelayDays] = useState(0);
  const [newCondition, setNewCondition] = useState("no_reply");
  const [newSubjectOverride, setNewSubjectOverride] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Edit step
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editDelayDays, setEditDelayDays] = useState(0);
  const [editCondition, setEditCondition] = useState("no_reply");
  const [editTemplateId, setEditTemplateId] = useState("");
  const [editSubjectOverride, setEditSubjectOverride] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;

  const fetchAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const [campRes, stepsRes, tplRes] = await Promise.all([
        fetch(`${apiBase}/api/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/campaigns/${campaignId}/sequences`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/email-templates`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!campRes.ok) { router.push("/campaigns"); return; }

      const campData = await campRes.json();
      setCampaign(campData);

      if (stepsRes.ok) {
        const stepsData = await stepsRes.json();
        setSteps(stepsData.steps || []);
      }

      if (tplRes.ok) {
        const tplData = await tplRes.json();
        setTemplates(tplData.templates || tplData || []);
      }

      // Fetch analytics if sequence is running
      if (campData.campaign_type === "sequence" && ["sending", "paused", "completed"].includes(campData.status)) {
        const analyticsRes = await fetch(`${apiBase}/api/campaigns/${campaignId}/sequence-analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiBase, campaignId, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !newTemplateId) return;

    setAddLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template_id: newTemplateId,
          delay_days: steps.length === 0 ? 0 : newDelayDays,
          condition: steps.length === 0 ? "always" : newCondition,
          subject_override: newSubjectOverride || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add step");

      setSteps(prev => [...prev, data]);
      setShowAddForm(false);
      setNewTemplateId("");
      setNewDelayDays(3);
      setNewCondition("no_reply");
      setNewSubjectOverride("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteStep(stepId: string) {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/sequences/${stepId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSteps(prev => prev.filter(s => s.id !== stepId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdateStep(stepId: string) {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/sequences/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template_id: editTemplateId,
          delay_days: editDelayDays,
          condition: editCondition,
          subject_override: editSubjectOverride || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }

      await fetchAll();
      setEditingStep(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(step: SequenceStep) {
    setEditingStep(step.id);
    setEditTemplateId(step.template_id);
    setEditDelayDays(step.delay_days);
    setEditCondition(step.condition);
    setEditSubjectOverride(step.subject_override || "");
  }

  async function handleStartSequence() {
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/start-sequence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start sequence");

      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/pause-sequence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResume() {
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/resume-sequence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const conditionLabels: Record<string, string> = {
    no_reply: "If No Reply",
    no_open: "If No Open",
    always: "Always Send",
  };

  if (loading) return <div className="p-8">Loading sequence builder...</div>;

  const isEditable = campaign?.status === "draft" || campaign?.status === "ready";
  const isRunning = campaign?.status === "sending";
  const isPaused = campaign?.status === "paused";
  const canStart = isEditable && steps.length > 0 && (campaign?.recipient_count ?? 0) > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/campaigns/${campaignId}`} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to campaign</Link>
          <h2 className="text-2xl font-bold mt-1">Sequence Builder</h2>
          <p className="text-sm text-gray-500">{campaign?.name} &mdash; {steps.length} step{steps.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {canStart && (
            <button onClick={handleStartSequence} disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              {actionLoading ? "Starting..." : "Start Sequence"}
            </button>
          )}
          {isRunning && (
            <button onClick={handlePause} disabled={actionLoading}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">
              Pause
            </button>
          )}
          {isPaused && (
            <button onClick={handleResume} disabled={actionLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              Resume
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error} <button onClick={() => setError(null)} className="ml-2 font-medium">Dismiss</button></div>}

      {/* Step Cards */}
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={step.id} className="bg-white border rounded-lg p-4 shadow-sm">
            {editingStep === step.id ? (
              /* EDIT MODE */
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-gray-400">Step {step.sequence_order}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Template</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm" value={editTemplateId} onChange={e => setEditTemplateId(e.target.value)}>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm" value={editCondition} onChange={e => setEditCondition(e.target.value)}>
                      <option value="no_reply">If No Reply</option>
                      <option value="no_open">If No Open</option>
                      <option value="always">Always Send</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Delay (days)</label>
                    <input type="number" min={0} max={60} className="w-full border rounded px-2 py-1.5 text-sm" value={editDelayDays} onChange={e => setEditDelayDays(parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subject Override</label>
                    <input type="text" className="w-full border rounded px-2 py-1.5 text-sm" value={editSubjectOverride} onChange={e => setEditSubjectOverride(e.target.value)} placeholder="(use template subject)" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditingStep(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                  <button onClick={() => handleUpdateStep(step.id)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                </div>
              </div>
            ) : (
              /* VIEW MODE */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">{step.sequence_order}</div>
                  <div>
                    <div className="font-medium text-sm">{step.template_name}</div>
                    <div className="text-xs text-gray-500">
                      {idx === 0 ? "Immediately" : `+${step.delay_days} day${step.delay_days !== 1 ? "s" : ""}`}
                      {idx > 0 && <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{conditionLabels[step.condition] || step.condition}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {analytics && analytics.steps[idx] && (
                    <span className="text-xs text-gray-400">{analytics.steps[idx].sent} sent</span>
                  )}
                  {isEditable && (
                    <>
                      <button onClick={() => startEdit(step)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => handleDeleteStep(step.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Connection line to next step */}
            {idx < steps.length - 1 && !editingStep && (
              <div className="flex justify-center py-1">
                <div className="w-px h-4 bg-gray-300" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Step */}
      {isEditable && steps.length < 5 && (
        showAddForm ? (
          <form onSubmit={handleAddStep} className="bg-white border border-dashed border-blue-300 rounded-lg p-4 space-y-3">
            <div className="text-sm font-semibold text-blue-700">Add Step {steps.length + 1}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Template</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm" value={newTemplateId} onChange={e => setNewTemplateId(e.target.value)} required>
                  <option value="">-- Choose Template --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {steps.length > 0 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
                    <select className="w-full border rounded px-2 py-1.5 text-sm" value={newCondition} onChange={e => setNewCondition(e.target.value)}>
                      <option value="no_reply">If No Reply</option>
                      <option value="no_open">If No Open</option>
                      <option value="always">Always Send</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Wait (days after previous)</label>
                    <input type="number" min={1} max={60} className="w-full border rounded px-2 py-1.5 text-sm" value={newDelayDays} onChange={e => setNewDelayDays(parseInt(e.target.value) || 1)} />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subject Override (optional)</label>
                <input type="text" className="w-full border rounded px-2 py-1.5 text-sm" value={newSubjectOverride} onChange={e => setNewSubjectOverride(e.target.value)} placeholder="(use template subject)" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
              <button type="submit" disabled={addLoading || !newTemplateId} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {addLoading ? "Adding..." : "Add Step"}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => { setShowAddForm(true); setNewDelayDays(steps.length === 0 ? 0 : 3); }}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600">
            + Add Step {steps.length + 1}
          </button>
        )
      )}

      {/* Analytics Section (for running/completed sequences) */}
      {analytics && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Sequence Analytics</h3>

          {/* Status Breakdown */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { key: "active", label: "Active", color: "text-green-600 bg-green-50" },
              { key: "paused", label: "Paused", color: "text-orange-600 bg-orange-50" },
              { key: "replied", label: "Replied", color: "text-blue-600 bg-blue-50" },
              { key: "completed", label: "Completed", color: "text-purple-600 bg-purple-50" },
              { key: "bounced", label: "Bounced", color: "text-red-600 bg-red-50" },
              { key: "unsubscribed", label: "Unsub", color: "text-gray-600 bg-gray-50" },
            ].map(s => (
              <div key={s.key} className={`rounded-lg p-3 text-center ${s.color}`}>
                <div className="text-2xl font-bold">{analytics.status_breakdown[s.key] || 0}</div>
                <div className="text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Step Funnel */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">Step Funnel</h4>
            <div className="space-y-2">
              {analytics.steps.map((s, idx) => {
                const maxSent = Math.max(...analytics.steps.map(st => st.sent), 1);
                const pct = (s.sent / maxSent) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-14 shrink-0">Step {s.step}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                      <div className="bg-blue-500 h-5 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">{s.sent} sent</span>
                    </div>
                    <span className="text-xs text-gray-400 w-32 truncate">{s.template_name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Engagement */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { key: "sent", label: "Sent", color: "text-blue-600" },
              { key: "opened", label: "Opened", color: "text-green-600" },
              { key: "clicked", label: "Clicked", color: "text-purple-600" },
              { key: "replied", label: "Replied", color: "text-amber-600" },
              { key: "bounced", label: "Bounced", color: "text-red-600" },
            ].map(e => (
              <div key={e.key} className="bg-white border rounded-lg p-3 text-center">
                <div className={`text-xl font-bold ${e.color}`}>{(analytics.engagement as any)[e.key] || 0}</div>
                <div className="text-xs text-gray-500">{e.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
