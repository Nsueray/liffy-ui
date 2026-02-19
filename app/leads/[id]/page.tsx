'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface PersonData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
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

interface PersonDetail {
  person: PersonData;
  affiliations: Affiliation[];
  intents: Intent[];
  engagement: EngagementEvent[];
  zoho_pushes: ZohoPush[];
}

interface VerifyResult {
  email: string;
  status: string;
  sub_status?: string;
}

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'valid': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'invalid': return 'bg-red-100 text-red-800 hover:bg-red-100';
    case 'catchall': return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
    case 'unknown': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

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

const getEngagementIcon = (type: string): string => {
  switch (type) {
    case 'sent': return '📤';
    case 'delivered': return '✅';
    case 'open': return '👁';
    case 'click': return '🔗';
    case 'reply': return '💬';
    case 'bounce': return '⚠️';
    case 'dropped': return '🚫';
    case 'spam_report': return '🚨';
    case 'unsubscribe': return '🔕';
    default: return '📧';
  }
};

const formatIntentType = (type: string): string => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default function PersonDetailPage() {
  useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const personId = params.id as string;

  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verify single
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  const getToken = () => localStorage.getItem('liffy_token');

  const fetchDetail = useCallback(async () => {
    const token = getToken();
    if (!token || !personId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/persons/${personId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.person) {
        setDetail(data as PersonDetail);
      } else if (data.id && data.email) {
        setDetail({
          person: data,
          affiliations: data.affiliations || [],
          intents: data.intents || [],
          engagement: data.engagement || [],
          zoho_pushes: data.zoho_pushes || []
        });
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load person';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleVerify = async () => {
    if (!detail) return;
    const token = getToken();
    if (!token) return;

    setVerifyLoading(true);
    setVerifyResult(null);
    setVerifyError(null);

    try {
      const res = await fetch('/api/verification/verify-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: detail.person.email })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setVerifyResult(data);
      // Refresh person data to get updated verification_status
      fetchDetail();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      setVerifyError(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    if (!confirm(`Delete ${detail.person.email}? This will remove all affiliations, intents, and push history.`)) return;

    const token = getToken();
    if (!token) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/persons/${personId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }

      router.push('/leads');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      alert(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatName = (p: PersonData) => {
    const parts = [p.first_name, p.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  };

  const totalEngagement = detail?.engagement.reduce((sum, e) => sum + parseInt(String(e.count), 10), 0) || 0;

  // Loading
  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground">Loading contact details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/leads')}>
          &larr; Back to Contacts
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchDetail}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!detail) return null;

  const person = detail.person;
  const name = formatName(person);

  return (
    <div className="p-6 space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.push('/leads')}>
          &larr; Back to Contacts
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={verifyLoading}
          >
            {verifyLoading ? 'Verifying...' : 'Verify Email'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Person Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-medium flex-shrink-0">
              {(person.first_name?.[0] || person.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900">
                {name || 'Unknown'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{person.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge className={getStatusBadgeClass(person.verification_status)}>
                  {person.verification_status}
                </Badge>
                {detail.intents.length > 0 && (
                  <Badge className="bg-orange-500 hover:bg-orange-500 text-white">
                    Prospect ({detail.intents.length} signal{detail.intents.length !== 1 ? 's' : ''})
                  </Badge>
                )}
                {totalEngagement > 0 && (
                  <Badge variant="outline">{totalEngagement} engagement events</Badge>
                )}
                {detail.zoho_pushes.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    Synced to Zoho
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Verify Result */}
          {verifyResult && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
              <span className="text-sm text-gray-600">Verification result:</span>
              <Badge className={getStatusBadgeClass(verifyResult.status)}>
                {verifyResult.status}
              </Badge>
              {verifyResult.sub_status && (
                <span className="text-sm text-gray-500">{verifyResult.sub_status}</span>
              )}
            </div>
          )}
          {verifyError && (
            <p className="mt-3 text-sm text-red-600">{verifyError}</p>
          )}
        </CardContent>
      </Card>

      {/* Grid: Affiliations + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Affiliations */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Affiliations ({detail.affiliations.length})
            </h3>
            {detail.affiliations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No affiliations found.</p>
            ) : (
              <div className="space-y-3">
                {detail.affiliations.map(aff => (
                  <div key={aff.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {aff.company_name || 'Unknown Company'}
                        </p>
                        {aff.position && (
                          <p className="text-sm text-gray-600 mt-0.5">{aff.position}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(aff.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      {aff.country_code && (
                        <span>{aff.city ? `${aff.city}, ` : ''}{aff.country_code}</span>
                      )}
                      {aff.phone && <span>{aff.phone}</span>}
                      {aff.website && (
                        <a
                          href={aff.website.startsWith('http') ? aff.website : `https://${aff.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {aff.website}
                        </a>
                      )}
                      {aff.source_type && (
                        <span className="text-violet-600">
                          {aff.source_type}
                          {aff.source_ref ? `: ${aff.source_ref.length > 40 ? aff.source_ref.substring(0, 37) + '...' : aff.source_ref}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Engagement ({totalEngagement} events)
            </h3>
            {detail.engagement.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaign engagement recorded.</p>
            ) : (
              <div className="space-y-2">
                {detail.engagement.map(ev => (
                  <div key={ev.event_type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getEngagementIcon(ev.event_type)}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">{ev.event_type}</p>
                        <p className="text-xs text-gray-500">
                          Last: {new Date(ev.last_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-gray-900">{ev.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Intent Signals */}
      {detail.intents.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Intent Signals ({detail.intents.length})
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.intents.map(intent => (
                  <TableRow key={intent.id}>
                    <TableCell>
                      <Badge className={getIntentBadgeClass(intent.intent_type)}>
                        {formatIntentType(intent.intent_type)}
                      </Badge>
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
                    <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                      {intent.notes || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(intent.occurred_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Zoho Push History */}
      {detail.zoho_pushes.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Zoho CRM Sync History
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.zoho_pushes.map((push, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        {push.zoho_module}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{push.action}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {push.zoho_record_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(push.pushed_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Metadata Footer */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
            <span>ID: {person.id}</span>
            <span>Created: {new Date(person.created_at).toLocaleString()}</span>
            <span>Updated: {new Date(person.updated_at).toLocaleString()}</span>
            {person.verified_at && (
              <span>Verified: {new Date(person.verified_at).toLocaleString()}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
