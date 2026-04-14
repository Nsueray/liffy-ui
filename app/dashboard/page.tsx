'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────

interface PersonStats {
  total: number;
  verified: number;
  invalid: number;
  unverified: number;
  with_intent: number;
}

interface OrgOverview {
  campaigns: { total: number; draft: number; scheduled: number; sending: number; completed: number; failed: number };
  recipients: { total: number; pending: number; sent: number; failed: number };
  events: Record<string, number>;
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

interface MiningJob {
  id: string;
  input: string;
  name: string;
  status: string;
  total_found: number | null;
  created_at: string;
}

interface MiningJobsResponse {
  jobs: MiningJob[];
  stats: { total: number; pending: number; running: number; completed: number; failed: number; total_emails: number };
}

interface IntentStats {
  total_persons_with_intent: number;
  by_type: Array<{ intent_type: string; count: number; unique_persons: number }>;
}

interface PipelineStageSummary {
  id: string;
  name: string;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  count: number;
}

interface PipelineBoardResponse {
  stages: PipelineStageSummary[];
  total_people: number;
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

const getJobBadgeClass = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'running': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    case 'pending': return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
    case 'failed': return 'bg-red-100 text-red-800 hover:bg-red-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

const truncateUrl = (url: string, max = 50): string => {
  if (!url) return '-';
  const clean = url.replace(/^https?:\/\/(www\.)?/, '');
  return clean.length > max ? clean.substring(0, max - 3) + '...' : clean;
};

// ── Component ──────────────────────────────────────────

export default function DashboardPage() {
  useAuthGuard();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  // Data
  const [personStats, setPersonStats] = useState<PersonStats | null>(null);
  const [orgOverview, setOrgOverview] = useState<OrgOverview | null>(null);
  const [intentStats, setIntentStats] = useState<IntentStats | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [recentJobs, setRecentJobs] = useState<MiningJob[]>([]);
  const [pipeline, setPipeline] = useState<PipelineBoardResponse | null>(null);

  useEffect(() => {
    // Get user name from localStorage
    try {
      const userStr = localStorage.getItem('liffy_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(user.name || user.email || '');
      }
    } catch {}

    const token = localStorage.getItem('liffy_token');
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const fetchAll = async () => {
      const results = await Promise.allSettled([
        // 0: Person stats
        fetch('/api/persons/stats', { headers }).then(r => r.ok ? r.json() : null),
        // 1: Org overview (reports)
        fetch('/api/reports/organizer/overview', { headers }).then(r => r.ok ? r.json() : null),
        // 2: Intent stats
        fetch('/api/intents/stats', { headers }).then(r => r.ok ? r.json() : null),
        // 3: Recent campaigns
        fetch('/api/campaigns', { headers }).then(r => r.ok ? r.json() : null),
        // 4: Recent mining jobs
        fetch('/api/mining/jobs?limit=5', { headers }).then(r => r.ok ? r.json() : null),
        // 5: Pipeline board (counts only)
        fetch('/api/pipeline/board?limit=1', { headers }).then(r => r.ok ? r.json() : null),
      ]);

      // Person stats
      if (results[0].status === 'fulfilled' && results[0].value) {
        setPersonStats(results[0].value);
      }

      // Org overview
      if (results[1].status === 'fulfilled' && results[1].value) {
        setOrgOverview(results[1].value);
      }

      // Intent stats
      if (results[2].status === 'fulfilled' && results[2].value) {
        setIntentStats(results[2].value);
      }

      // Recent campaigns — bare array, take last 5 sorted by date
      if (results[3].status === 'fulfilled' && results[3].value) {
        const allCampaigns: Campaign[] = Array.isArray(results[3].value)
          ? results[3].value
          : results[3].value.campaigns || [];
        const sorted = allCampaigns
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);
        setRecentCampaigns(sorted);
      }

      // Mining jobs
      if (results[4].status === 'fulfilled' && results[4].value) {
        const data = results[4].value as MiningJobsResponse;
        setRecentJobs((data.jobs || []).slice(0, 5));
      }

      // Pipeline board
      if (results[5].status === 'fulfilled' && results[5].value) {
        setPipeline(results[5].value as PipelineBoardResponse);
      }

      setLoading(false);
    };

    fetchAll();
  }, []);

  // Derived stats
  const totalSent = orgOverview?.recipients?.sent ?? orgOverview?.events?.sent ?? 0;
  const totalOpen = orgOverview?.events?.unique_open ?? orgOverview?.events?.open ?? 0;
  const totalBounce = orgOverview?.events?.unique_bounce ?? orgOverview?.events?.bounce ?? 0;
  const openRate = totalSent > 0 ? ((totalOpen / totalSent) * 100) : 0;
  const bounceRate = totalSent > 0 ? ((totalBounce / totalSent) * 100) : 0;
  const totalCampaigns = orgOverview?.campaigns?.total ?? recentCampaigns.length;
  const activeCampaigns = (orgOverview?.campaigns?.sending ?? 0) + (orgOverview?.campaigns?.scheduled ?? 0);
  const prospectCount = intentStats?.total_persons_with_intent ?? personStats?.with_intent ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s an overview of your Liffy platform activity.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overview Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/leads')}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold">{(personStats?.total ?? 0).toLocaleString()}</p>
              {personStats && personStats.verified > 0 && (
                <p className="text-xs text-green-600 mt-1">{personStats.verified} verified</p>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/campaigns')}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Campaigns</p>
              <p className="text-2xl font-bold">{totalCampaigns.toLocaleString()}</p>
              {activeCampaigns > 0 && (
                <p className="text-xs text-blue-600 mt-1">{activeCampaigns} active</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Emails Sent</p>
              <p className="text-2xl font-bold text-blue-600">{totalSent.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Open Rate</p>
              <p className="text-2xl font-bold text-green-600">{openRate.toFixed(1)}%</p>
              {totalOpen > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{totalOpen.toLocaleString()} opens</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Bounce Rate</p>
              <p className={`text-2xl font-bold ${bounceRate > 5 ? 'text-red-600' : 'text-gray-600'}`}>
                {bounceRate.toFixed(1)}%
              </p>
              {totalBounce > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{totalBounce.toLocaleString()} bounces</p>
              )}
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/prospects')}>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Prospects</p>
              <p className="text-2xl font-bold text-orange-500">{prospectCount.toLocaleString()}</p>
              {intentStats && intentStats.by_type.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {intentStats.by_type.reduce((s, t) => s + t.count, 0)} signals
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push('/campaigns')} size="sm">
              New Campaign
            </Button>
            <Button onClick={() => router.push('/mining/jobs/new')} variant="outline" size="sm">
              New Mining Job
            </Button>
            <Button onClick={() => router.push('/lists')} variant="outline" size="sm">
              Upload CSV
            </Button>
            <Button onClick={() => router.push('/leads')} variant="outline" size="sm">
              View Contacts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity — side by side */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Campaigns */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Recent Campaigns</h3>
                <Button variant="ghost" size="sm" onClick={() => router.push('/campaigns')} className="text-xs">
                  View all
                </Button>
              </div>
              {recentCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No campaigns yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentCampaigns.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => router.push(`/campaigns/${c.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${getCampaignBadgeClass(c.status)} text-xs`}>
                            {c.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {c.recipient_count || 0} recipients
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Mining Jobs */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Recent Mining Jobs</h3>
                <Button variant="ghost" size="sm" onClick={() => router.push('/mining/jobs')} className="text-xs">
                  View all
                </Button>
              </div>
              {recentJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No mining jobs yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map(j => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => router.push(`/mining/jobs/${j.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {j.name || truncateUrl(j.input)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${getJobBadgeClass(j.status)} text-xs`}>
                            {j.status}
                          </Badge>
                          {j.total_found !== null && j.total_found > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {j.total_found} found
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                        {new Date(j.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pipeline Summary */}
      {!loading && pipeline && pipeline.stages.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Pipeline Summary</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pipeline.total_people.toLocaleString()} contacts across {pipeline.stages.length} stages
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/pipeline')} className="text-xs">
                View board
              </Button>
            </div>

            <div className="space-y-2">
              {pipeline.stages.map(s => {
                const pct = pipeline.total_people > 0
                  ? (s.count / pipeline.total_people) * 100
                  : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-40 flex-shrink-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-sm text-gray-700 truncate">{s.name}</span>
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-10 text-right">
                      {s.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton for recent activity */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-4" />
                {[0, 1, 2].map(j => (
                  <div key={j} className="p-3 bg-gray-50 rounded-lg mb-3">
                    <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
