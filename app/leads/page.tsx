// FILE: app/leads/page.tsx
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, verificationStatus, country]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      if (debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim());
      }
      if (verificationStatus && verificationStatus !== 'all') {
        params.append('verification_status', verificationStatus);
      }
      if (country.trim()) {
        params.append('country', country.trim());
      }
      
      const response = await fetch(`/api/leads?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }
      
      const data: LeadsResponse = await response.json();
      setLeads(data.leads);
      setTotal(data.total);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, verificationStatus, country]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const totalPages = Math.ceil(total / limit);

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'valid':
        return 'default';
      case 'invalid':
        return 'destructive';
      case 'risky':
      case 'catchall':
      case 'unknown':
        return 'secondary';
      case 'pending':
      default:
        return 'outline';
    }
  };

  const formatSource = (sourceType: string | null, sourceRef: string | null): { display: string; isMined: boolean } => {
    const isMined = sourceType === 'mining' || sourceType === 'scraper' || sourceType === 'mined';
    
    if (sourceType && sourceRef) {
      let displayRef = sourceRef;
      if (sourceRef.startsWith('http')) {
        try {
          const url = new URL(sourceRef);
          displayRef = url.hostname.replace('www.', '');
        } catch {
          displayRef = sourceRef.length > 30 ? sourceRef.substring(0, 27) + '...' : sourceRef;
        }
      } else if (sourceRef.length > 30) {
        displayRef = sourceRef.substring(0, 27) + '...';
      }
      return { display: `${sourceType}: ${displayRef}`, isMined };
    }
    
    if (sourceType) {
      return { display: sourceType, isMined };
    }
    
    if (sourceRef) {
      let displayRef = sourceRef;
      if (sourceRef.startsWith('http')) {
        try {
          const url = new URL(sourceRef);
          displayRef = url.hostname.replace('www.', '');
        } catch {
          displayRef = sourceRef.length > 30 ? sourceRef.substring(0, 27) + '...' : sourceRef;
        }
      }
      return { display: displayRef, isMined: false };
    }
    
    return { display: '-', isMined: false };
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const clearFilters = () => {
    setSearch('');
    setVerificationStatus('all');
    setCountry('');
    setPage(1);
  };

  const hasActiveFilters = search.trim() || (verificationStatus && verificationStatus !== 'all') || country.trim();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Leads</h1>
        {!loading && (
          <span className="text-sm text-muted-foreground">
            {total.toLocaleString()} lead{total !== 1 ? 's' : ''} total
          </span>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <Input
                placeholder="Search email, name, company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <Select value={verificationStatus} onValueChange={setVerificationStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {VERIFICATION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Input
                placeholder="Filter by country..."
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-destructive">{error}</span>
              <Button variant="outline" size="sm" onClick={fetchLeads}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading leads...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && leads.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <h3 className="font-medium text-muted-foreground">No leads found</h3>
              {hasActiveFilters ? (
                <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Import leads or start mining to populate your database.</p>
              )}
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && leads.length > 0 && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{source.display}</span>
                          {source.isMined && (
                            <Badge variant="secondary" className="text-xs bg-violet-600 text-white hover:bg-violet-600">
                              Mined
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(lead.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total.toLocaleString()} leads
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
