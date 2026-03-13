'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthHeaders } from '@/lib/auth';
import { useAuthGuard } from '@/hooks/useAuthGuard';

interface Prospect {
  id: string;
  person_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  intent_type: string;
  campaign_id: string | null;
  campaign_name: string | null;
  source: string | null;
  confidence: number | null;
  occurred_at: string;
  created_at: string;
}

interface ProspectStats {
  total_prospects: number;
  total_signals: number;
  replies: number;
  clicks: number;
}

interface ProspectsResponse {
  total: number;
  page: number;
  limit: number;
  stats: ProspectStats;
  prospects: Prospect[];
}

const INTENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'reply', label: 'Reply' },
  { value: 'click_through', label: 'Click Through' },
  { value: 'form_submission', label: 'Form Submission' },
  { value: 'manual_qualification', label: 'Manual' },
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'inbound_request', label: 'Inbound Request' },
  { value: 'referral', label: 'Referral' },
];

const getIntentBadgeClass = (type: string): string => {
  switch (type) {
    case 'reply': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'click_through': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    case 'form_submission': return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
    case 'manual_qualification': return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
    case 'meeting_booked': return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100';
    case 'inbound_request': return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100';
    case 'referral': return 'bg-pink-100 text-pink-800 hover:bg-pink-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

const formatIntentType = (type: string): string => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default function ProspectsPage() {
  useAuthGuard();
  const router = useRouter();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [intentType, setIntentType] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [stats, setStats] = useState<ProspectStats | null>(null);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, intentType]);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (intentType) params.append('intent_type', intentType);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`/api/prospects?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Failed to fetch prospects');

      const data: ProspectsResponse = await res.json();

      setProspects(data.prospects);
      setTotal(data.total);
      if (data.stats) setStats(data.stats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, intentType, debouncedSearch]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || intentType;

  const clearFilters = () => {
    setSearch('');
    setIntentType('');
  };

  const formatName = (item: Prospect) => {
    const parts = [item.first_name, item.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  const startRecord = total > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prospects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${stats?.total_prospects?.toLocaleString() || 0} prospects with ${stats?.total_signals?.toLocaleString() || 0} intent signals`}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Prospects</p>
              <p className="text-2xl font-bold text-orange-500">{stats.total_prospects.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Signals</p>
              <p className="text-2xl font-bold">{stats.total_signals.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Replies</p>
              <p className="text-2xl font-bold text-green-600">{stats.replies.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Clicks</p>
              <p className="text-2xl font-bold text-blue-600">{stats.clicks.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search name, email, company, campaign..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select
              value={intentType}
              onChange={e => setIntentType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {INTENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchProspects}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground">Loading prospects...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && prospects.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No prospects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters or search terms.'
                  : 'Prospects appear when contacts reply to campaigns or show strong intent signals.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && prospects.length > 0 && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map(prospect => {
                  const name = formatName(prospect);

                  return (
                    <TableRow key={prospect.id} className="hover:bg-orange-50/50">
                      <TableCell className="font-medium">
                        {prospect.company_name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <div>
                          {name || <span className="text-muted-foreground">-</span>}
                          {prospect.job_title && (
                            <p className="text-xs text-muted-foreground">{prospect.job_title}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{prospect.email}</TableCell>
                      <TableCell>
                        <Badge className={getIntentBadgeClass(prospect.intent_type)}>
                          {formatIntentType(prospect.intent_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {prospect.campaign_name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(prospect.occurred_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/leads/${prospect.person_id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {startRecord.toLocaleString()} - {endRecord.toLocaleString()} of {total.toLocaleString()} signals
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
