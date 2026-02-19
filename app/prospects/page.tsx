'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface IntentItem {
  id: string;
  person_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  intent_type: string;
  campaign_id: string | null;
  campaign_name: string | null;
  source: string | null;
  notes: string | null;
  confidence: number | null;
  occurred_at: string;
  created_at: string;
}

interface IntentsResponse {
  total: number;
  page: number;
  limit: number;
  intents: IntentItem[];
}

interface IntentTypeStat {
  intent_type: string;
  count: number;
  unique_persons: number;
  last_at: string | null;
}

interface IntentStats {
  total_persons_with_intent: number;
  by_type: IntentTypeStat[];
}

const INTENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'reply', label: 'Reply' },
  { value: 'click_through', label: 'Click Through' },
  { value: 'form_submission', label: 'Form Submission' },
  { value: 'manual_qualification', label: 'Manual Qualification' },
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'inbound_request', label: 'Inbound Request' },
  { value: 'referral', label: 'Referral' },
];

const SOURCES = [
  { value: '', label: 'All Sources' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'manual', label: 'Manual' },
  { value: 'api', label: 'API' },
  { value: 'automation', label: 'Automation' },
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
  const [intents, setIntents] = useState<IntentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [intentType, setIntentType] = useState('');
  const [source, setSource] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [stats, setStats] = useState<IntentStats | null>(null);

  // Detail expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('liffy_token');

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, intentType, source]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/intents/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: IntentStats = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch intent stats', err);
    }
  }, []);

  // Fetch intents list
  const fetchIntents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (intentType) params.append('intent_type', intentType);
      if (source) params.append('source', source);
      // Note: backend intents endpoint doesn't support text search directly,
      // but we can filter by person_id if needed. For now we filter client-side.

      const token = getToken();
      const res = await fetch(`/api/intents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch prospects');

      const data: IntentsResponse = await res.json();

      // Client-side search filter (name/email)
      let filtered = data.intents;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        filtered = filtered.filter(i =>
          i.email?.toLowerCase().includes(q) ||
          i.first_name?.toLowerCase().includes(q) ||
          i.last_name?.toLowerCase().includes(q) ||
          i.campaign_name?.toLowerCase().includes(q)
        );
      }

      setIntents(filtered);
      setTotal(debouncedSearch ? filtered.length : data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, intentType, source, debouncedSearch]);

  useEffect(() => {
    fetchIntents();
  }, [fetchIntents]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || intentType || source;

  const clearFilters = () => {
    setSearch('');
    setIntentType('');
    setSource('');
  };

  const formatName = (item: IntentItem) => {
    const parts = [item.first_name, item.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  const startRecord = total > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = Math.min(page * limit, total);

  const totalIntents = stats?.by_type.reduce((sum, t) => sum + t.count, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prospects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${total.toLocaleString()} intent signals from ${stats?.total_persons_with_intent?.toLocaleString() || 0} persons`}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Prospects</p>
              <p className="text-2xl font-bold text-orange-500">{stats.total_persons_with_intent.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Signals</p>
              <p className="text-2xl font-bold">{totalIntents.toLocaleString()}</p>
            </CardContent>
          </Card>
          {stats.by_type.slice(0, 2).map(t => (
            <Card key={t.intent_type}>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">{formatIntentType(t.intent_type)}</p>
                <p className="text-2xl font-bold">{t.count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t.unique_persons} persons</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Intent Type Breakdown — show all types if more than 2 */}
      {stats && stats.by_type.length > 2 && (
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          {stats.by_type.map(t => (
            <button
              key={t.intent_type}
              onClick={() => setIntentType(intentType === t.intent_type ? '' : t.intent_type)}
              className={`p-2 rounded-lg text-center text-sm transition-colors border ${
                intentType === t.intent_type
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Badge className={`${getIntentBadgeClass(t.intent_type)} text-xs mb-1`}>
                {formatIntentType(t.intent_type)}
              </Badge>
              <p className="font-semibold text-gray-900">{t.count}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search name, email, campaign..."
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

            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
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
              <Button variant="outline" size="sm" onClick={fetchIntents}>
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
      {!loading && !error && intents.length === 0 && (
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
      {!loading && !error && intents.length > 0 && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Intent Type</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intents.map(intent => {
                  const name = formatName(intent);
                  const isExpanded = expandedId === intent.id;

                  return (
                    <TableRow
                      key={intent.id}
                      className="cursor-pointer hover:bg-orange-50/50"
                      onClick={() => setExpandedId(isExpanded ? null : intent.id)}
                    >
                      <TableCell className="font-medium">
                        {name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>{intent.email}</TableCell>
                      <TableCell>
                        <Badge className={getIntentBadgeClass(intent.intent_type)}>
                          {formatIntentType(intent.intent_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {intent.campaign_name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {intent.source ? (
                          <span className="text-sm capitalize">{intent.source}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {intent.confidence !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-500 rounded-full"
                                style={{ width: `${Math.round(intent.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(intent.confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(intent.occurred_at).toLocaleDateString()}
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
