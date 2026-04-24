"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";

interface SequenceStep {
  id: string;
  sequence_order: number;
  template_id: string;
  template_name: string;
  template_subject: string;
  template_body_preview?: string;
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

interface StepProgress {
  step: number;
  sent_count: number;
  engagement?: {
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
  };
  status: string;
  next_send_at?: string;
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
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
  const [stepProgress, setStepProgress] = useState<StepProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);

  // Template preview popover
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

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

      // Fetch analytics if sequence is running/paused/completed/sequencing
      if (campData.campaign_type === "sequence" && ["sending", "paused", "completed", "sequencing"].includes(campData.status)) {
        const [analyticsRes, progressRes] = await Promise.all([
          fetch(`${apiBase}/api/campaigns/${campaignId}/sequence-analytics`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiBase}/api/campaigns/${campaignId}/sequence-progress`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
        ]);
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          setStepProgress(progressData.steps || []);
        }
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

  async function handleReorder(stepId: string, direction: "up" | "down") {
    const token = getToken();
    if (!token || reorderLoading) return;

    const idx = steps.findIndex(s => s.id === stepId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= steps.length) return;

    setReorderLoading(true);
    try {
      const newSteps = [...steps];
      const tempOrder = newSteps[idx].sequence_order;
      newSteps[idx].sequence_order = newSteps[swapIdx].sequence_order;
      newSteps[swapIdx].sequence_order = tempOrder;
      [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
      setSteps(newSteps);

      const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/sequences/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          steps: newSteps.map(s => ({ id: s.id, sequence_order: s.sequence_order })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
    } catch (err: any) {
      setError(err.message);
      await fetchAll();
    } finally {
      setReorderLoading(false);
    }
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

  const conditionDescriptions: Record<string, (days: number) => string> = {
    no_reply: (d) => `If no reply after ${d} day${d !== 1 ? "s" : ""}, send this follow-up`,
    no_open: (d) => `If not opened after ${d} day${d !== 1 ? "s" : ""}, send this follow-up`,
    always: (d) => d > 0 ? `Always send after ${d} day${d !== 1 ? "s" : ""}` : "Send immediately",
  };

  function getStepProgress(stepOrder: number): StepProgress | undefined {
    return stepProgress.find(p => p.step === stepOrder);
  }

  function totalDuration(): number {
    return steps.reduce((sum, s) => sum + (s.delay_days || 0), 0);
  }

  if (loading) return <div className="p-8">Loading sequence builder...</div>;

  const isEditable = campaign?.status === "draft" || campaign?.status === "ready";
  const isRunning = campaign?.status === "sending" || campaign?.status === "sequencing";
  const isPaused = campaign?.status === "paused";
  const canStart = isEditable && steps.length > 0 && (campaign?.recipient_count ?? 0) > 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
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

      {/* Visual Timeline */}
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const progress = getStepProgress(step.sequence_order);
          const bodyPreview = step.template_body_preview ? stripHtml(step.template_body_preview).slice(0, 200) : null;

          return (
            <div key={step.id}>
              {/* Wait node between steps */}
              {idx > 0 && !editingStep && (
                <div className="flex items-center justify-center py-1">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-3 bg-gray-300" />
                    <div className="px-3 py-1 bg-orange-50 border border-orange-200 rounded-full text-xs text-orange-600 font-medium">
                      Wait {step.delay_days} day{step.delay_days !== 1 ? "s" : ""}
                    </div>
                    <div className="w-px h-3 bg-gray-300" />
                  </div>
                </div>
              )}

              {/* Step Card */}
              <div className="bg-white border rounded-lg p-4 shadow-sm">
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
                      <button onClick={() => handleUpdateStep(step.id)} className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600">Save</button>
                    </div>
                  </div>
                ) : (
                  /* VIEW MODE */
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 text-sm font-bold shrink-0">{step.sequence_order}</div>
                        <div className="min-w-0 flex-1 relative"
                          onMouseEnter={() => {
                            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                            hoverTimeout.current = setTimeout(() => setHoveredStep(step.id), 300);
                          }}
                          onMouseLeave={() => {
                            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                            setHoveredStep(null);
                          }}
                        >
                          <div className="font-medium text-sm truncate">{step.template_name}</div>
                          <div className="text-xs text-gray-500">
                            {idx === 0
                              ? conditionDescriptions["always"](0)
                              : conditionDescriptions[step.condition]?.(step.delay_days) || `${step.condition} after ${step.delay_days}d`
                            }
                          </div>

                          {/* Template Preview Popover */}
                          {hoveredStep === step.id && (
                            <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
                              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Template Preview</div>
                              <div className="text-sm font-medium text-gray-800">{step.subject_override || step.template_subject}</div>
                              {bodyPreview && (
                                <p className="text-xs text-gray-500 leading-relaxed">{bodyPreview}{bodyPreview.length >= 200 ? "..." : ""}</p>
                              )}
                              <Link href={`/templates?edit=${step.template_id}`}
                                className="inline-block text-xs text-orange-600 hover:text-orange-700 font-medium mt-1">
                                Open template &rarr;
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {/* Reorder buttons */}
                        {isEditable && steps.length > 1 && (
                          <div className="flex flex-col mr-2">
                            <button onClick={() => handleReorder(step.id, "up")} disabled={idx === 0 || reorderLoading}
                              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed p-0.5" title="Move up">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button onClick={() => handleReorder(step.id, "down")} disabled={idx === steps.length - 1 || reorderLoading}
                              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed p-0.5" title="Move down">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                        )}
                        {isEditable && (
                          <>
                            <button onClick={() => startEdit(step)} className="text-xs text-orange-600 hover:text-orange-800 px-1.5 py-1">Edit</button>
                            <button onClick={() => handleDeleteStep(step.id)} className="text-xs text-red-500 hover:text-red-700 px-1.5 py-1">Delete</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline Step Performance Stats */}
                    {progress && progress.sent_count > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-gray-500 font-medium">{progress.sent_count} sent</span>
                          {progress.engagement && (
                            <>
                              <span className="text-green-600">{progress.engagement.delivery_rate}% delivered</span>
                              <span className="text-blue-600">{progress.engagement.open_rate}% opened</span>
                              <span className="text-purple-600">{progress.engagement.click_rate}% clicked</span>
                            </>
                          )}
                          {progress.status === "completed" && (
                            <span className="ml-auto px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-medium">Done</span>
                          )}
                          {progress.status === "waiting" && progress.next_send_at && (
                            <span className="ml-auto text-gray-400 text-[10px]">Next: {new Date(progress.next_send_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total Duration */}
      {steps.length > 1 && !editingStep && (
        <div className="text-center text-xs text-gray-400">
          Total sequence duration: <span className="font-medium text-gray-600">{totalDuration()} day{totalDuration() !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Add Step */}
      {isEditable && steps.length < 5 && (
        showAddForm ? (
          <form onSubmit={handleAddStep} className="bg-white border border-dashed border-orange-300 rounded-lg p-4 space-y-3">
            <div className="text-sm font-semibold text-orange-700">Add Step {steps.length + 1}</div>
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
              <button type="submit" disabled={addLoading || !newTemplateId} className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">
                {addLoading ? "Adding..." : "Add Step"}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => { setShowAddForm(true); setNewDelayDays(steps.length === 0 ? 0 : 3); }}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600">
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
                      <div className="bg-orange-400 h-5 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
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
              { key: "replied", label: "Replied", color: "text-orange-600" },
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
