'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Lead {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  country: string | null;
  verification_status: string;
  source_type: string | null;
  source_ref: string | null;
  created_at: string;
}

interface LeadsResponse {
  page: number;
  limit: number;
  total: number;
  leads: Lead[];
}

const VERIFICATION_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'valid', label: 'Valid' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'risky', label: 'Risky' },
  { value: 'catchall', label: 'Catch-all' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'pending', label: 'Pending' }
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(500);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('all');
  const [country, setCountry] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, verificationStatus, country]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (verificationStatus && verificationStatus !== 'all') {
        params.append('verification_status', verificationStatus);
      }
      if (country) params.append('country', country);

      const token = localStorage.getItem('liffy_token');

      const res = await fetch(`/api/leads?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to fetch leads');

      const data: LeadsResponse = await res.json();
      setLeads(data.leads);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, verificationStatus, country]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || (verificationStatus && verificationStatus !== 'all') || country;

  const clearFilters = () => {
    setSearch('');
    setVerificationStatus('all');
    setCountry('');
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'valid': return 'default';
      case 'invalid': return 'destructive';
      case 'risky':
      case 'catchall':
      case 'unknown': return 'secondary';
      default: return 'outline';
    }
  };

  const formatSource = (sourceType: string | null, sourceRef: string | null) => {
    const isMined = sourceType === 'mining' || sourceType === 'scraper' || sourceType === 'mined';
    
    let display = '-';
    if (sourceType && sourceRef) {
      let shortRef = sourceRef;
      if (sourceRef.startsWith('http')) {
        try {
          shortRef = new URL(sourceRef).hostname.replace('www.', '');
        } catch {
          shortRef = sourceRef.length > 25 ? sourceRef.substring(0, 22) + '...' : sourceRef;
        }
      } else if (sourceRef.length > 25) {
        shortRef = sourceRef.substring(0, 22) + '...';
      }
      display = `${sourceType}: ${shortRef}`;
    } else if (sourceType) {
      display = sourceType;
    } else if (sourceRef) {
      display = sourceRef.length > 25 ? sourceRef.substring(0, 22) + '...' : sourceRef;
    }

    return { display, isMined };
  };

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${total.toLocaleString()} total leads`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <Input
                placeholder="Search email, name, company..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Verification Status */}
            <Select value={verificationStatus} onValueChange={setVerificationStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {VERIFICATION_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Country */}
            <Input
              placeholder="Filter by country..."
              value={country}
              onChange={e => setCountry(e.target.value)}
            />

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className={!hasActiveFilters ? 'opacity-50' : ''}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchLeads}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground">Loading leads...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && leads.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No leads found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters or search terms.'
                  : 'Import leads or run a mining job to get started.'}
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
      {!loading && !error && leads.length > 0 && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map(lead => {
                  const source = formatSource(lead.source_type, lead.source_ref);
                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.email}</TableCell>
                      <TableCell>{lead.name || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{lead.company || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{lead.country || <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(lead.verification_status)}>
                          {lead.verification_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{source.display}</span>
                          {source.isMined && (
                            <Badge className="text-xs bg-violet-600 hover:bg-violet-600 text-white">
                              Mined
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString()}
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
              Showing {startRecord.toLocaleString()} - {endRecord.toLocaleString()} of {total.toLocaleString()} leads
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
