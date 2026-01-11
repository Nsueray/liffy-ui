'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthGuard } from '@/hooks/useAuthGuard';

interface ListMember {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  country: string | null;
  verification_status: string;
  source_type: string | null;
  created_at: string;
}

interface ListDetail {
  id: string;
  name: string;
  created_at: string;
  total_leads: number;
  verified_count: number;
  unverified_count: number;
  members: ListMember[];
}

export default function ListDetailPage() {
  useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;

  const [list, setList] = useState<ListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!listId) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('liffy_token');
      const res = await fetch(`/api/lists/${listId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('List not found');
        }
        throw new Error('Failed to fetch list');
      }

      const data = await res.json();
      setList({
        id: data.id,
        name: data.name || 'Unnamed List',
        created_at: data.created_at,
        total_leads: Number(data.total_leads) || 0,
        verified_count: Number(data.verified_count) || 0,
        unverified_count: Number(data.unverified_count) || 0,
        members: Array.isArray(data.members) ? data.members : []
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleRemoveMember = async (prospectId: string) => {
    if (!confirm('Remove this lead from the list?')) return;

    try {
      const token = localStorage.getItem('liffy_token');
      const res = await fetch(`/api/lists/${listId}/members/${prospectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to remove member');

      setList(prev => {
        if (!prev) return prev;
        const newMembers = prev.members.filter(m => m.id !== prospectId);
        const newVerified = newMembers.filter(m => m.verification_status === 'valid').length;
        return {
          ...prev,
          members: newMembers,
          total_leads: newMembers.length,
          verified_count: newVerified,
          unverified_count: newMembers.length - newVerified
        };
      });
    } catch (e: any) {
      alert(e.message);
    }
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

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground">Loading list...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <p className="text-red-600">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push('/lists')}>
                  Back to Lists
                </Button>
                <Button variant="outline" onClick={fetchList}>
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => router.push('/lists')}>
              ← Back
            </Button>
          </div>
          <h1 className="text-2xl font-semibold">{list.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created on {formatDate(list.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Leads</p>
            <p className="text-2xl font-semibold">{formatNumber(list.total_leads)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Verified</p>
            <p className="text-2xl font-semibold text-green-600">{formatNumber(list.verified_count)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unverified</p>
            <p className="text-2xl font-semibold text-gray-500">{formatNumber(list.unverified_count)}</p>
          </CardContent>
        </Card>
      </div>

      {list.members.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No leads in this list</h3>
              <p className="text-sm text-muted-foreground">
                This list is empty. Create a new list with filters to add leads.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.members.map(member => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>{member.name || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>{member.company || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>{member.country || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(member.verification_status)}>
                      {member.verification_status || 'pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>{member.source_type || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
