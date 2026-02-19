'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Person {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  company_name: string | null;
  position: string | null;
  country_code: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  has_intent: boolean;
}

interface PersonsResponse {
  page: number;
  limit: number;
  total: number;
  persons: Person[];
}

interface PersonStats {
  total: number;
  verified: number;
  invalid: number;
  unverified: number;
  with_intent: number;
}

interface PersonDetail {
  person: Person;
  affiliations: Affiliation[];
  intents: Intent[];
  engagement: EngagementEvent[];
  zoho_pushes: ZohoPush[];
}

interface Affiliation {
  id: string;
  company_name: string | null;
  position: string | null;
  country_code: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  source_type: string | null;
  source_ref: string | null;
  created_at: string;
}

interface Intent {
  id: string;
  intent_type: string;
  campaign_id: string | null;
  source: string | null;
  notes: string | null;
  confidence: number | null;
  occurred_at: string;
  created_at: string;
}

interface EngagementEvent {
  event_type: string;
  count: number;
  last_at: string;
}

interface ZohoPush {
  zoho_module: string;
  zoho_record_id: string;
  action: string;
  status: string;
  pushed_at: string;
}

const VERIFICATION_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'valid', label: 'Valid' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'catchall', label: 'Catch-all' },
  { value: 'unknown', label: 'Unknown' },
];

export default function ContactsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [country, setCountry] = useState('');
  const [company, setCompany] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [stats, setStats] = useState<PersonStats | null>(null);

  // Detail panel
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const getToken = () => localStorage.getItem('liffy_token');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, verificationStatus, country, company]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/persons/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: PersonStats = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, []);

  // Fetch persons list
  const fetchPersons = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (verificationStatus) params.append('verification_status', verificationStatus);
      if (country) params.append('country', country);
      if (company) params.append('company', company);

      const token = getToken();

      const res = await fetch(`/api/persons?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch contacts');

      const data: PersonsResponse = await res.json();
      setPersons(data.persons);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, verificationStatus, country, company]);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch person detail
  const openDetail = async (personId: string) => {
    setSelectedPersonId(personId);
    setDetail(null);
    setDetailLoading(true);

    try {
      const token = getToken();
      const res = await fetch(`/api/persons/${personId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch person detail');

      const data: PersonDetail = await res.json();
      setDetail(data);
    } catch (err) {
      console.error('Failed to load person detail', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedPersonId(null);
    setDetail(null);
  };

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || verificationStatus || country || company;

  const clearFilters = () => {
    setSearch('');
    setVerificationStatus('');
    setCountry('');
    setCompany('');
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'valid': return 'default';
      case 'invalid': return 'destructive';
      case 'catchall':
      case 'unknown': return 'secondary';
      default: return 'outline';
    }
  };

  const formatName = (p: Person) => {
    const parts = [p.first_name, p.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  const startRecord = total > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${total.toLocaleString()} total contacts`}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Verified</p>
              <p className="text-2xl font-bold text-green-600">{stats.verified.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Unverified</p>
              <p className="text-2xl font-bold text-gray-500">{stats.unverified.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Prospects</p>
              <p className="text-2xl font-bold text-orange-500">{stats.with_intent.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search name, email, company..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select
              value={verificationStatus}
              onChange={e => setVerificationStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {VERIFICATION_STATUSES.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <Input
              placeholder="Filter by country..."
              value={country}
              onChange={e => setCountry(e.target.value)}
            />

            <Input
              placeholder="Filter by company..."
              value={company}
              onChange={e => setCompany(e.target.value)}
            />

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
              <Button variant="outline" size="sm" onClick={fetchPersons}>
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
              <p className="text-muted-foreground">Loading contacts...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && persons.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No contacts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters or search terms.'
                  : 'Import contacts or run a mining job to get started.'}
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
      {!loading && !error && persons.length > 0 && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons.map(person => {
                  const name = formatName(person);

                  return (
                    <TableRow
                      key={person.id}
                      className="cursor-pointer hover:bg-orange-50/50"
                      onClick={() => openDetail(person.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {name || <span className="text-muted-foreground">-</span>}
                          {person.has_intent && (
                            <Badge className="text-xs bg-orange-500 hover:bg-orange-500 text-white">
                              Prospect
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{person.email}</TableCell>
                      <TableCell>{person.company_name || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{person.position || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{person.country_code || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(person.verification_status)}>
                          {person.verification_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(person.created_at).toLocaleDateString()}
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
              Showing {startRecord.toLocaleString()} - {endRecord.toLocaleString()} of {total.toLocaleString()} contacts
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

      {/* Person Detail Slide-over */}
      {selectedPersonId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">Contact Detail</h2>
              <button
                onClick={closeDetail}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {detailLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {detail && (
              <div className="p-6 space-y-6">
                {/* Person Header */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-medium">
                      {(detail.person.first_name?.[0] || detail.person.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {[detail.person.first_name, detail.person.last_name].filter(Boolean).join(' ') || 'Unknown'}
                      </h3>
                      <p className="text-sm text-gray-500">{detail.person.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant={getStatusVariant(detail.person.verification_status)}>
                      {detail.person.verification_status}
                    </Badge>
                    {detail.intents.length > 0 && (
                      <Badge className="bg-orange-500 hover:bg-orange-500 text-white">
                        Prospect
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Affiliations */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Affiliations ({detail.affiliations.length})</h4>
                  {detail.affiliations.length === 0 ? (
                    <p className="text-sm text-gray-500">No affiliations found.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.affiliations.map(aff => (
                        <div key={aff.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                          <div className="font-medium text-gray-900">
                            {aff.company_name || 'Unknown Company'}
                          </div>
                          {aff.position && (
                            <div className="text-gray-600">{aff.position}</div>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-gray-500 text-xs">
                            {aff.country_code && <span>{aff.city ? `${aff.city}, ` : ''}{aff.country_code}</span>}
                            {aff.phone && <span>{aff.phone}</span>}
                            {aff.website && <span>{aff.website}</span>}
                            {aff.source_type && (
                              <span className="text-violet-600">
                                {aff.source_type}{aff.source_ref ? `: ${aff.source_ref.length > 30 ? aff.source_ref.substring(0, 27) + '...' : aff.source_ref}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Engagement Summary */}
                {detail.engagement.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Engagement</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {detail.engagement.map(ev => (
                        <div key={ev.event_type} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="font-medium text-gray-900 capitalize">{ev.event_type}</div>
                          <div className="text-xs text-gray-500">
                            {ev.count}x &middot; Last: {new Date(ev.last_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Intent Signals */}
                {detail.intents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Intent Signals ({detail.intents.length})</h4>
                    <div className="space-y-2">
                      {detail.intents.map(intent => (
                        <div key={intent.id} className="p-2 bg-orange-50 rounded text-sm flex items-center justify-between">
                          <div>
                            <Badge variant="outline" className="text-xs mr-2">{intent.intent_type}</Badge>
                            {intent.source && <span className="text-gray-500 text-xs">{intent.source}</span>}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(intent.occurred_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Zoho Push History */}
                {detail.zoho_pushes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Zoho CRM</h4>
                    <div className="space-y-2">
                      {detail.zoho_pushes.map((push, i) => (
                        <div key={i} className="p-2 bg-blue-50 rounded text-sm flex items-center justify-between">
                          <div>
                            <Badge variant="outline" className="text-xs mr-2">{push.zoho_module}</Badge>
                            <span className="text-gray-500 text-xs">{push.action}</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(push.pushed_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="text-xs text-gray-400 border-t pt-4">
                  <p>Created: {new Date(detail.person.created_at).toLocaleString()}</p>
                  <p>Updated: {new Date(detail.person.updated_at).toLocaleString()}</p>
                  {detail.person.verified_at && (
                    <p>Verified: {new Date(detail.person.verified_at).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
