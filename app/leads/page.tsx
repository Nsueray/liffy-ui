'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

const STATUS_OPTIONS = ['valid', 'invalid', 'risky', 'catchall', 'unknown', 'pending'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(500);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [country, setCountry] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

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
      if (verificationStatus) params.append('verification_status', verificationStatus);
      if (country) params.append('country', country);

      const res = await fetch(`/api/leads?${params.toString()}`);
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input placeholder="Search email, name, company…" value={search} onChange={e => setSearch(e.target.value)} />

          <Input
            placeholder="Verification status"
            list="statuses"
            value={verificationStatus}
            onChange={e => setVerificationStatus(e.target.value)}
          />
          <datalist id="statuses">
            {STATUS_OPTIONS.map(s => <option key={s} value={s} />)}
          </datalist>

          <Input placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />

          <Button variant="outline" onClick={() => { setSearch(''); setCountry(''); setVerificationStatus(''); }}>
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {loading && <p>Loading leads…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && leads.length > 0 && (
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
              {leads.map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.email}</TableCell>
                  <TableCell>{l.name || '-'}</TableCell>
                  <TableCell>{l.company || '-'}</TableCell>
                  <TableCell>{l.country || '-'}</TableCell>
                  <TableCell>
                    <Badge>{l.verification_status}</Badge>
                  </TableCell>
                  <TableCell>{l.source_type || '-'}</TableCell>
                  <TableCell>{new Date(l.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex gap-2">
          <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span>Page {page} / {totalPages}</span>
          <Button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
