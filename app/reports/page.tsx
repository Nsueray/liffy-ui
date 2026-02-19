'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────

interface OrgOverview {
  campaigns: { total: number; draft: number; scheduled: number; sending: number; completed: number; failed: number };
  recipients: { total: number; pending: number; sent: number; failed: number };
  events: Record<string, number>;
  timeline: Array<{ date: string; total: number; [key: string]: string | number }>;
  domains: Array<{ domain: string; total: number; delivered: number; bounced: number; opened: number }>;
  bounce_reasons: Array<{ reason: string; count: number }>;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  recipient_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  total: number;
}

// ── Helpers ────────────────────────────────────────────

const getCampaignBadgeClass = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'sending': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    case 'scheduled': return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
    case 'ready': return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100';
    case 'paused': return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
    case 'draft': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    case 'failed': return 'bg-red-100 text-red-800 hover:bg-red-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

const pct = (num: number, den: number): string => {
  if (den === 0) return '0.0%';
  return ((num / den) * 100).toFixed(1) + '%';
};

// ── Component ──────────────────────────────────────────

export default function ReportsPage() {
  useAuthGuard();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OrgOverview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('liffy_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const fetchData = async () => {
      const [overviewRes, campaignsRes] = await Promise.allSettled([
        fetch('/api/reports/organizer/overview', { headers }).then(r => r.ok ? r.json() : null),
        fetch('/api/campaigns', { headers }).then(r => r.ok ? r.json() : null),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverview(overviewRes.value);
      }

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value) {
        const all: Campaign[] = Array.isArray(campaignsRes.value) ? campaignsRes.value : [];
        const sorted = all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setCampaigns(sorted);

        // Fetch per-campaign stats for non-draft campaigns (max 20)
        const sendable = sorted.filter(c => c.status !== 'draft').slice(0, 20);
        if (sendable.length > 0) {
          setStatsLoading(true);
          const statResults = await Promise.allSettled(
            sendable.map(c =>
              fetch(`/api/campaigns/${c.id}/stats`, { headers })
                .then(r => r.ok ? r.json() : null)
                .then(data => ({ id: c.id, stats: data }))
            )
          );

          const statsMap: Record<string, CampaignStats> = {};
          for (const r of statResults) {
            if (r.status === 'fulfilled' && r.value?.stats) {
              const d = r.value.stats;
              statsMap[r.value.id] = {
                sent: parseInt(d.sent, 10) || 0,
                delivered: parseInt(d.delivered, 10) || 0,
                opened: parseInt(d.opened, 10) || 0,
                clicked: parseInt(d.clicked, 10) || 0,
                bounced: parseInt(d.bounced, 10) || 0,
                total: parseInt(d.total, 10) || 0,
              };
            }
          }
          setCampaignStats(statsMap);
          setStatsLoading(false);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Derived from overview
  const totalSent = overview?.recipients?.sent ?? overview?.events?.sent ?? 0;
  const totalDelivered = overview?.events?.delivered ?? 0;
  const totalOpen = overview?.events?.open ?? 0;
  const totalClick = overview?.events?.click ?? 0;
  const totalBounce = overview?.events?.bounce ?? 0;
  const totalReply = overview?.events?.reply ?? 0;
  const totalSpam = overview?.events?.spam_report ?? 0;
  const totalEvents = overview?.events?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organization-wide email performance and campaign analytics.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground">Loading reports...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Org-Wide Summary Cards */}
      {!loading && overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Campaigns</p>
                <p className="text-2xl font-bold">{overview.campaigns.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview.campaigns.completed} completed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Emails Sent</p>
                <p className="text-2xl font-bold text-blue-600">{totalSent.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold text-green-600">{totalDelivered.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">{pct(totalDelivered, totalSent)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-bold text-emerald-600">{pct(totalOpen, totalSent)}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalOpen.toLocaleString()} opens</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Click Rate</p>
                <p className="text-2xl font-bold text-cyan-600">{pct(totalClick, totalSent)}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalClick.toLocaleString()} clicks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Bounce Rate</p>
                <p className={`text-2xl font-bold ${totalBounce / Math.max(totalSent, 1) > 0.05 ? 'text-red-600' : 'text-gray-600'}`}>
                  {pct(totalBounce, totalSent)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{totalBounce.toLocaleString()} bounces</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Replies</p>
                <p className="text-2xl font-bold text-orange-500">{totalReply.toLocaleString()}</p>
                {totalSpam > 0 && (
                  <p className="text-xs text-red-500 mt-1">{totalSpam} spam reports</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Campaign Comparison Table */}
      {!loading && campaigns.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign Comparison</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Opened</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Bounced</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead className="text-right">Click Rate</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map(c => {
                    const s = campaignStats[c.id];
                    const sent = s?.sent ?? 0;
                    const opened = s?.opened ?? 0;
                    const clicked = s?.clicked ?? 0;
                    const bounced = s?.bounced ?? 0;
                    const hasStat = !!s;

                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-orange-50/50"
                        onClick={() => router.push(`/campaigns/${c.id}`)}
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {c.name}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getCampaignBadgeClass(c.status)} text-xs`}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.recipient_count || 0}</TableCell>
                        <TableCell className="text-right">
                          {hasStat ? sent.toLocaleString() : (
                            statsLoading ? <span className="text-gray-300">...</span> : <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasStat ? opened.toLocaleString() : (
                            statsLoading ? <span className="text-gray-300">...</span> : <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasStat ? clicked.toLocaleString() : (
                            statsLoading ? <span className="text-gray-300">...</span> : <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasStat ? bounced.toLocaleString() : (
                            statsLoading ? <span className="text-gray-300">...</span> : <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasStat && sent > 0 ? (
                            <span className={opened / sent > 0.2 ? 'text-green-600 font-medium' : ''}>
                              {pct(opened, sent)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasStat && sent > 0 ? (
                            <span className={clicked / sent > 0.05 ? 'text-cyan-600 font-medium' : ''}>
                              {pct(clicked, sent)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain Breakdown + Bounce Reasons — side by side */}
      {!loading && overview && (overview.domains.length > 0 || overview.bounce_reasons.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Domain Breakdown */}
          {overview.domains.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Domain Breakdown (Top {Math.min(overview.domains.length, 20)})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Delivered</TableHead>
                      <TableHead className="text-right">Opened</TableHead>
                      <TableHead className="text-right">Bounced</TableHead>
                      <TableHead className="text-right">Bounce %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.domains.slice(0, 20).map(d => (
                      <TableRow key={d.domain}>
                        <TableCell className="font-mono text-sm">{d.domain}</TableCell>
                        <TableCell className="text-right">{d.total}</TableCell>
                        <TableCell className="text-right">{d.delivered}</TableCell>
                        <TableCell className="text-right">{d.opened}</TableCell>
                        <TableCell className="text-right">{d.bounced}</TableCell>
                        <TableCell className="text-right">
                          <span className={d.total > 0 && d.bounced / d.total > 0.1 ? 'text-red-600 font-medium' : ''}>
                            {pct(d.bounced, d.total)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Bounce Reasons */}
          {overview.bounce_reasons.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Bounce Reasons
                </h3>
                <div className="space-y-3">
                  {overview.bounce_reasons.map((br, i) => {
                    const maxCount = overview.bounce_reasons[0]?.count || 1;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 truncate max-w-[280px]">{br.reason}</span>
                          <span className="text-sm font-medium text-gray-900 ml-2 flex-shrink-0">{br.count}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full transition-all"
                            style={{ width: `${(br.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !overview && campaigns.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No report data yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Reports will appear here once you start sending campaigns.
              </p>
              <Button variant="outline" onClick={() => router.push('/campaigns')}>
                Go to Campaigns
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
