"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Campaign {
  id: string;
  name: string;
  status: string;
  campaign_type?: string;
  template_id: string;
  template_name?: string;
  template_subject?: string;
  list_id?: string | null;
  list_name?: string | null;
  sender_id?: string | null;
  sender_email?: string | null;
  sender_name?: string | null;
  recipient_count?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  creator_name?: string | null;
}

interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

interface AnalyticsSummary {
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  bounces: number;
  spam_reports: number;
  unsubscribes: number;
  replies: number;
  dropped: number;
  deferred: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  spam_rate: number;
  unsubscribe_rate: number;
}

interface TimelineEntry {
  period: string;
  sent?: number;
  delivered?: number;
  open?: number;
  click?: number;
  bounce?: number;
  [key: string]: string | number | undefined;
}

interface TopLink {
  url: string;
  clicks: number;
}

interface BounceBreakdown {
  hard: number;
  soft: number;
  unknown: number;
  total: number;
}

interface AnalyticsData {
  campaign: any;
  summary: AnalyticsSummary;
  timeline: TimelineEntry[];
  top_links: TopLink[];
  bounce_breakdown: BounceBreakdown;
}

interface Recipient {
  id: string;
  email: string;
  name?: string;
  status: string;
  meta?: any;
  sent_at?: string | null;
  last_error?: string | null;
  created_at: string;
}

export default function CampaignDetailPage() {
  useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [seqProgress, setSeqProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const pageSize = 50;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";
  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;

  // Fetch campaign details, stats, and analytics
  const fetchCampaign = useCallback(async () => {
    const token = getToken();
    if (!token || !campaignId) return;

    try {
      // Fetch campaign details
      const campRes = await fetch(`${apiBase}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!campRes.ok) {
        if (campRes.status === 404) {
          router.push('/campaigns');
          return;
        }
        throw new Error('Failed to fetch campaign');
      }

      const campData = await campRes.json();
      setCampaign(campData);

      // Fetch simple stats
      const statsRes = await fetch(`${apiBase}/api/campaigns/${campaignId}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // Fetch analytics
      const analyticsRes = await fetch(`${apiBase}/api/campaigns/${campaignId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (analyticsRes.ok) {
        const analyticsData: AnalyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }

      // Fetch sequence progress if sequence campaign
      if (campData.campaign_type === 'sequence') {
        try {
          const seqRes = await fetch(`${apiBase}/api/campaigns/${campaignId}/sequence-progress`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (seqRes.ok) {
            setSeqProgress(await seqRes.json());
          }
        } catch { /* ignore */ }
      }

    } catch (err: any) {
      setError(err.message);
    }
  }, [apiBase, campaignId, router]);

  // Fetch recipients
  const fetchRecipients = useCallback(async () => {
    const token = getToken();
    if (!token || !campaignId) return;

    try {
      const offset = (currentPage - 1) * pageSize;
      let url = `${apiBase}/api/campaigns/${campaignId}/recipients?limit=${pageSize}&offset=${offset}`;

      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
        setTotalRecipients(data.pagination?.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch recipients:', err);
    }
  }, [apiBase, campaignId, currentPage, statusFilter]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchCampaign();
      await fetchRecipients();
      setLoading(false);
    };
    loadData();
  }, [fetchCampaign, fetchRecipients]);

  // Refetch recipients when filter or page changes
  useEffect(() => {
    if (!loading) {
      fetchRecipients();
    }
  }, [statusFilter, currentPage]);

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatShortDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
      opened: "bg-purple-100 text-purple-800",
      clicked: "bg-indigo-100 text-indigo-800",
      failed: "bg-red-100 text-red-800",
      bounced: "bg-orange-100 text-orange-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  }

  function getCampaignStatusBadge(status: string) {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      ready: "bg-blue-100 text-blue-800",
      scheduled: "bg-cyan-100 text-cyan-800",
      sending: "bg-green-100 text-green-800",
      sequencing: "bg-indigo-100 text-indigo-800",
      paused: "bg-orange-100 text-orange-800",
      completed: "bg-purple-100 text-purple-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  }

  const totalPages = Math.ceil(totalRecipients / pageSize);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500">Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || "Campaign not found"}
        </div>
        <Link href="/campaigns" className="text-blue-600 hover:underline mt-4 inline-block">
          &larr; Back to Campaigns
        </Link>
      </div>
    );
  }

  const summary = analytics?.summary;

  // Prepare timeline data for chart
  const timelineData = (analytics?.timeline || []).map(entry => ({
    ...entry,
    date: formatShortDate(entry.period),
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/campaigns" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            &larr; Back to Campaigns
          </Link>
          <h2 className="text-3xl font-bold">{campaign.name}</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-3 py-1 text-sm rounded-full font-semibold ${getCampaignStatusBadge(campaign.status)}`}>
              {campaign.status}
            </span>
            {campaign.campaign_type === "sequence" && <span className="px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 font-semibold">Sequence</span>}
            {campaign.creator_name && <span className="text-gray-500 text-sm">by {campaign.creator_name}</span>}
            <span className="text-gray-500 text-sm">Created {formatDate(campaign.created_at)}</span>
            {campaign.started_at && (
              <span className="text-gray-500 text-sm">Started {formatDate(campaign.started_at)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Template</p>
          <p className="font-medium truncate">{campaign.template_name || campaign.template_subject || "-"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">List</p>
          <p className="font-medium">{campaign.list_name || "-"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Sender</p>
          <p className="font-medium truncate">{campaign.sender_email || "-"}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Recipients</p>
          <p className="font-medium text-2xl">{campaign.recipient_count || 0}</p>
        </div>
      </div>

      {/* Sequence Builder Link (only for sequence campaigns) */}
      {campaign.campaign_type === "sequence" && (
        <div className="space-y-3">
          <Link href={`/campaigns/${campaign.id}/sequences`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-sm font-medium">
            Sequence Builder &rarr;
          </Link>

          {/* Sequence Progress */}
          {seqProgress && seqProgress.steps && seqProgress.steps.length > 0 && (
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Sequence Progress</h3>
                <span className="text-xs text-gray-400">
                  {seqProgress.completed_steps}/{seqProgress.total_steps} steps completed
                </span>
              </div>
              <div className="space-y-3">
                {seqProgress.steps.map((step: any, idx: number) => {
                  const active = step.recipients?.active || 0;
                  const bounced = step.recipients?.bounced || 0;
                  const stepStatus = step.status; // 'completed' | 'waiting' | 'pending'
                  const eng = step.engagement;

                  // Countdown calculation for waiting steps
                  let countdown = '';
                  let isOverdue = false;
                  if (stepStatus === 'waiting' && step.next_send_at) {
                    const diff = new Date(step.next_send_at).getTime() - Date.now();
                    if (diff < 0) {
                      isOverdue = true;
                      countdown = 'Overdue';
                    } else {
                      const days = Math.floor(diff / 86400000);
                      const hours = Math.floor((diff % 86400000) / 3600000);
                      const mins = Math.floor((diff % 3600000) / 60000);
                      if (days > 0) countdown = `in ${days}d ${hours}h`;
                      else if (hours > 0) countdown = `in ${hours}h ${mins}m`;
                      else countdown = `in ${mins}m`;
                    }
                  }

                  const conditionLabel = step.condition === 'always' ? 'All recipients'
                    : step.condition === 'no_open' ? 'Non-openers'
                    : step.condition === 'no_click' ? 'Non-clickers'
                    : step.condition === 'no_reply' ? 'Non-repliers'
                    : step.condition;

                  const borderClass = stepStatus === 'completed' ? 'border-green-200 bg-green-50'
                    : stepStatus === 'waiting' ? 'border-indigo-200 bg-indigo-50'
                    : 'border-gray-200 bg-gray-50';
                  const circleClass = stepStatus === 'completed' ? 'bg-green-500 text-white'
                    : stepStatus === 'waiting' ? 'bg-indigo-500 text-white'
                    : 'bg-gray-300 text-white';

                  return (
                    <div key={idx} className={`p-4 rounded-lg border ${borderClass}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${circleClass}`}>
                          {step.sequence_order}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {step.subject || `Step ${step.sequence_order}`}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {step.delay_days === 0 ? 'Sent immediately' : `+${step.delay_days} day${step.delay_days > 1 ? 's' : ''} after Step ${step.sequence_order - 1}`}
                            {' \u00b7 '}{conditionLabel}
                          </p>

                          {/* Completed step — engagement stats */}
                          {stepStatus === 'completed' && (
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                              <span className="text-gray-700">{step.sent_count.toLocaleString()} sent</span>
                              {eng && (
                                <>
                                  <span className="text-gray-600">{eng.delivery_rate}% delivered</span>
                                  <span className="text-purple-700">{eng.open_rate}% opened</span>
                                  <span className="text-blue-700">{eng.clicked} clicked</span>
                                  <span className="text-orange-600">{eng.bounced} bounced</span>
                                </>
                              )}
                              {!eng && <span className="text-green-700">{step.sent_count} sent</span>}
                            </div>
                          )}

                          {/* Waiting step — countdown + recipient counts */}
                          {stepStatus === 'waiting' && (
                            <div className="mt-2 space-y-1">
                              <p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-indigo-700'}`}>
                                {isOverdue ? 'Overdue — should have sent already' : `Sends ${countdown}`}
                                {step.next_send_at && !isOverdue && (
                                  <span className="text-gray-400 font-normal"> ({formatDate(step.next_send_at)})</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-600">
                                {active.toLocaleString()} recipients waiting
                                {bounced > 0 && <span className="text-gray-400"> · {bounced} excluded (bounced)</span>}
                              </p>
                            </div>
                          )}

                          {/* Pending step — not yet reached */}
                          {stepStatus === 'pending' && (
                            <p className="mt-1.5 text-xs text-gray-400">
                              Pending — will run after Step {step.sequence_order - 1}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Summary Cards */}
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Sent */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-500">Sent</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary.sent.toLocaleString()}</p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Delivered */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-500">Delivered</p>
              <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">
                {summary.delivery_rate}%
              </span>
            </div>
            <p className="text-3xl font-bold text-cyan-600">{summary.delivered.toLocaleString()}</p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(summary.delivery_rate, 100)}%` }} />
            </div>
          </div>

          {/* Opened */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-500">Opened</p>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {summary.open_rate}%
              </span>
            </div>
            <p className="text-3xl font-bold text-green-600">{summary.opens.toLocaleString()}</p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(summary.open_rate, 100)}%` }} />
            </div>
          </div>

          {/* Clicked */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-500">Clicked</p>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                {summary.click_rate}%
              </span>
            </div>
            <p className="text-3xl font-bold text-purple-600">{summary.clicks.toLocaleString()}</p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(summary.click_rate, 100)}%` }} />
            </div>
          </div>

          {/* Replied */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-500">Replied</p>
            </div>
            <p className="text-3xl font-bold text-amber-600">{(summary.replies || 0).toLocaleString()}</p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${summary.sent > 0 ? Math.min((summary.replies || 0) / summary.sent * 100, 100) : 0}%` }} />
            </div>
          </div>

          {/* Bounced */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-500">Bounced</p>
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {summary.bounce_rate}%
              </span>
            </div>
            <p className="text-3xl font-bold text-red-500">{summary.bounces.toLocaleString()}</p>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(summary.bounce_rate, 100)}%` }} />
            </div>
          </div>
        </div>
      ) : stats && (
        /* Fallback to simple stats if analytics not available */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            <p className="text-sm text-gray-500">Sent</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.opened}</p>
            <p className="text-sm text-gray-500">Opened</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.clicked}</p>
            <p className="text-sm text-gray-500">Clicked</p>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.bounced}</p>
            <p className="text-sm text-gray-500">Bounced</p>
          </div>
        </div>
      )}

      {/* Secondary Stats Row */}
      {summary && (summary.spam_reports > 0 || summary.unsubscribes > 0 || summary.replies > 0 || summary.deferred > 0) && (
        <div className="flex flex-wrap gap-3">
          {summary.replies > 0 && (
            <div className="flex items-center gap-2 bg-white rounded-lg border px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-600">Replies: <span className="font-semibold">{summary.replies}</span></span>
            </div>
          )}
          {summary.deferred > 0 && (
            <div className="flex items-center gap-2 bg-white rounded-lg border px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-sm text-gray-600">Deferred: <span className="font-semibold">{summary.deferred}</span></span>
            </div>
          )}
          {summary.spam_reports > 0 && (
            <div className="flex items-center gap-2 bg-white rounded-lg border px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-gray-600">Spam Reports: <span className="font-semibold">{summary.spam_reports}</span> ({summary.spam_rate}%)</span>
            </div>
          )}
          {summary.unsubscribes > 0 && (
            <div className="flex items-center gap-2 bg-white rounded-lg border px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-sm text-gray-600">Unsubscribes: <span className="font-semibold">{summary.unsubscribes}</span> ({summary.unsubscribe_rate}%)</span>
            </div>
          )}
        </div>
      )}

      {/* Timeline Chart */}
      {timelineData.length > 1 && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="font-semibold mb-4">Engagement Timeline</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" name="Sent" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="open" name="Opened" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="click" name="Clicked" fill="#a855f7" radius={[2, 2, 0, 0]} />
                <Bar dataKey="bounce" name="Bounced" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Links & Bounce Breakdown side by side */}
      {(analytics?.top_links?.length || analytics?.bounce_breakdown?.total) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Links */}
          {analytics.top_links.length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Top Clicked Links</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.top_links.map((link, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-blue-600 max-w-xs truncate">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline" title={link.url}>
                          {link.url.length > 60 ? link.url.substring(0, 57) + '...' : link.url}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{link.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bounce Breakdown */}
          {analytics.bounce_breakdown && analytics.bounce_breakdown.total > 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h3 className="font-semibold mb-4">Bounce Breakdown</h3>
              <div className="space-y-4">
                {/* Visual bar */}
                <div className="flex rounded-full overflow-hidden h-4">
                  {analytics.bounce_breakdown.hard > 0 && (
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${(analytics.bounce_breakdown.hard / analytics.bounce_breakdown.total) * 100}%` }}
                      title={`Hard: ${analytics.bounce_breakdown.hard}`}
                    />
                  )}
                  {analytics.bounce_breakdown.soft > 0 && (
                    <div
                      className="bg-orange-400 transition-all"
                      style={{ width: `${(analytics.bounce_breakdown.soft / analytics.bounce_breakdown.total) * 100}%` }}
                      title={`Soft: ${analytics.bounce_breakdown.soft}`}
                    />
                  )}
                  {analytics.bounce_breakdown.unknown > 0 && (
                    <div
                      className="bg-gray-300 transition-all"
                      style={{ width: `${(analytics.bounce_breakdown.unknown / analytics.bounce_breakdown.total) * 100}%` }}
                      title={`Unknown: ${analytics.bounce_breakdown.unknown}`}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-red-500" />
                      <span className="text-sm text-gray-600">Hard Bounce</span>
                    </div>
                    <span className="text-sm font-semibold">{analytics.bounce_breakdown.hard}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-orange-400" />
                      <span className="text-sm text-gray-600">Soft Bounce</span>
                    </div>
                    <span className="text-sm font-semibold">{analytics.bounce_breakdown.soft}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-gray-300" />
                      <span className="text-sm text-gray-600">Unknown</span>
                    </div>
                    <span className="text-sm font-semibold">{analytics.bounce_breakdown.unknown}</span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total Bounces</span>
                    <span className="text-lg font-bold text-red-600">{analytics.bounce_breakdown.total}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Recipients Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Recipients</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Filter:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="failed">Failed</option>
              <option value="bounced">Bounced</option>
            </select>
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recipients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {statusFilter !== 'all' ? `No recipients with status "${statusFilter}"` : 'No recipients yet'}
                </td>
              </tr>
            ) : (
              recipients.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{r.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{r.name || "-"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getStatusBadge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.sent_at)}</td>
                  <td className="px-6 py-4 text-sm text-red-500 max-w-xs truncate" title={r.last_error || ''}>
                    {r.last_error || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecipients)} of {totalRecipients} recipients
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
