'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

interface VerifyResult {
  email: string;
  status: string;
  sub_status?: string;
}

interface ProcessResult {
  processed: number;
  results: Array<{
    email: string;
    status: string;
    sub_status?: string;
    error?: string;
  }>;
}

interface ListItem {
  id: string;
  name: string;
  total_leads: number;
  verified_count: number;
}

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'valid': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'invalid': return 'bg-red-100 text-red-800 hover:bg-red-100';
    case 'catchall': return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
    case 'unknown': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    case 'pending': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    case 'processing': return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
    case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
    case 'failed': return 'bg-red-100 text-red-800 hover:bg-red-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

export default function VerificationPage() {
  useAuthGuard();

  // Queue status
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Credits
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  // Single verify
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Batch process
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<ProcessResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Batch size
  const [batchSize, setBatchSize] = useState('50');

  // List verification
  const [lists, setLists] = useState<ListItem[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [listVerifyLoading, setListVerifyLoading] = useState(false);

  const getToken = () => localStorage.getItem('liffy_token');

  // Fetch queue status
  const fetchQueueStatus = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/verification/queue-status', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch queue status');
      }

      const data: QueueStatus = await res.json();
      setQueueStatus(data);
      setQueueError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch queue status';
      setQueueError(msg);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  // Fetch credits
  const fetchCredits = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setCreditsLoading(true);
    setCreditsError(null);

    try {
      const res = await fetch('/api/verification/credits', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch credits');

      setCredits(data.credits);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch credits';
      setCreditsError(msg);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  // Fetch lists
  const fetchLists = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setListsLoading(true);
    try {
      const res = await fetch('/api/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setLists(Array.isArray(data.lists) ? data.lists : []);
      }
    } catch {
      // silent
    } finally {
      setListsLoading(false);
    }
  }, []);

  // Single verify
  const handleVerifySingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail || !verifyEmail.includes('@')) return;

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
        body: JSON.stringify({ email: verifyEmail })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setVerifyResult(data);
      // Refresh credits and queue after verify
      fetchCredits();
      fetchQueueStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      setVerifyError(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Process queue batch
  const handleProcessQueue = async () => {
    const token = getToken();
    if (!token) return;

    setBatchLoading(true);
    setBatchResult(null);
    setBatchError(null);

    try {
      const size = Math.min(Math.max(parseInt(batchSize, 10) || 50, 1), 200);
      const res = await fetch('/api/verification/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ batch_size: size })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Queue processing failed');

      setBatchResult(data);
      // Refresh status after processing
      fetchCredits();
      fetchQueueStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Queue processing failed';
      setBatchError(msg);
    } finally {
      setBatchLoading(false);
    }
  };

  // Verify list
  const handleVerifyList = async () => {
    if (!selectedListId) return;

    const token = getToken();
    if (!token) return;

    setListVerifyLoading(true);
    try {
      const res = await fetch('/api/verification/verify-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ list_id: selectedListId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to queue list verification');

      const queued = data.queued || data.queued_count || 0;
      const listName = lists.find(l => l.id === selectedListId)?.name || 'list';
      toast.success(`${queued} email${queued !== 1 ? 's' : ''} from "${listName}" queued for verification`);
      setSelectedListId('');
      fetchQueueStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to queue list verification';
      toast.error(msg);
    } finally {
      setListVerifyLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStatus();
    fetchCredits();
    fetchLists();
  }, [fetchQueueStatus, fetchCredits, fetchLists]);

  // Auto-refresh queue status every 15s
  useEffect(() => {
    const interval = setInterval(fetchQueueStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchQueueStatus]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Verification</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify email addresses via ZeroBounce to reduce bounces and protect sender reputation.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-blue-500">
              {queueLoading ? '...' : (queueStatus?.pending ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Processing</p>
            <p className="text-2xl font-bold text-purple-500">
              {queueLoading ? '...' : (queueStatus?.processing ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-500">
              {queueLoading ? '...' : (queueStatus?.completed ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-500">
              {queueLoading ? '...' : (queueStatus?.failed ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ZeroBounce Credits</p>
                <p className="text-2xl font-bold text-orange-500">
                  {creditsLoading ? '...' : credits !== null ? credits.toLocaleString() : '---'}
                </p>
              </div>
              <button
                onClick={fetchCredits}
                disabled={creditsLoading}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Refresh credits"
              >
                <svg className={`w-4 h-4 ${creditsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            {creditsError && (
              <p className="text-xs text-red-500 mt-1">{creditsError}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {queueError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{queueError}</p>
              <Button variant="outline" size="sm" onClick={fetchQueueStatus}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single Verify + Verify a List + Batch Process */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Single Email Verify */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Verify Single Email</h3>
            <form onSubmit={handleVerifySingle} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={verifyEmail}
                  onChange={(e) => setVerifyEmail(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  disabled={verifyLoading || !verifyEmail}
                  className="shrink-0"
                >
                  {verifyLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying
                    </span>
                  ) : 'Verify'}
                </Button>
              </div>

              {verifyResult && (
                <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm font-mono">{verifyResult.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Status:</span>
                    <Badge className={getStatusBadgeClass(verifyResult.status)}>
                      {verifyResult.status}
                    </Badge>
                  </div>
                  {verifyResult.sub_status && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Detail:</span>
                      <span className="text-sm text-gray-500">{verifyResult.sub_status}</span>
                    </div>
                  )}
                </div>
              )}

              {verifyError && (
                <p className="text-sm text-red-600">{verifyError}</p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Verify a List */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Verify a List</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Queue all emails from a list for verification. The worker processes them automatically.
            </p>
            <div className="space-y-3">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                disabled={listsLoading}
              >
                <option value="">
                  {listsLoading ? 'Loading lists...' : 'Select a list'}
                </option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.total_leads} leads, {l.verified_count} verified)
                  </option>
                ))}
              </select>
              <Button
                onClick={handleVerifyList}
                disabled={listVerifyLoading || !selectedListId}
                className="w-full"
              >
                {listVerifyLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Queuing...
                  </span>
                ) : 'Start Verification'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Batch Process Queue */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Process Verification Queue</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Manually trigger queue processing. The worker also runs automatically every 30 seconds.
            </p>
            <div className="flex gap-2 mb-3">
              <div className="w-24">
                <Input
                  type="number"
                  min="1"
                  max="200"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  placeholder="50"
                />
              </div>
              <span className="text-sm text-muted-foreground self-center">emails per batch</span>
            </div>
            <Button
              onClick={handleProcessQueue}
              disabled={batchLoading || (queueStatus?.pending ?? 0) === 0}
              variant="outline"
              className="w-full"
            >
              {batchLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                `Process Queue (${queueStatus?.pending ?? 0} pending)`
              )}
            </Button>

            {batchResult && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  Processed {batchResult.processed} email{batchResult.processed !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {batchError && (
              <p className="text-sm text-red-600 mt-3">{batchError}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Batch Results Table */}
      {batchResult && batchResult.results && batchResult.results.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Last Batch Results ({batchResult.results.length} processed)
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchResult.results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.email}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeClass(r.status)}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.error || r.sub_status || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Queue Progress Bar */}
      {queueStatus && queueStatus.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Queue Progress</h3>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
              {queueStatus.completed > 0 && (
                <div
                  className="bg-green-500 h-full transition-all duration-500"
                  style={{ width: `${(queueStatus.completed / queueStatus.total) * 100}%` }}
                  title={`Completed: ${queueStatus.completed}`}
                />
              )}
              {queueStatus.processing > 0 && (
                <div
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{ width: `${(queueStatus.processing / queueStatus.total) * 100}%` }}
                  title={`Processing: ${queueStatus.processing}`}
                />
              )}
              {queueStatus.failed > 0 && (
                <div
                  className="bg-red-500 h-full transition-all duration-500"
                  style={{ width: `${(queueStatus.failed / queueStatus.total) * 100}%` }}
                  title={`Failed: ${queueStatus.failed}`}
                />
              )}
              {queueStatus.pending > 0 && (
                <div
                  className="bg-blue-200 h-full transition-all duration-500"
                  style={{ width: `${(queueStatus.pending / queueStatus.total) * 100}%` }}
                  title={`Pending: ${queueStatus.pending}`}
                />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Completed ({queueStatus.completed})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Processing ({queueStatus.processing})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Failed ({queueStatus.failed})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-200 inline-block" /> Pending ({queueStatus.pending})
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!queueLoading && !queueError && queueStatus && queueStatus.total === 0 && !verifyResult && !batchResult && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No emails in queue</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Verify a single email above, select a list to verify, or upload a CSV list to automatically queue emails for verification.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {queueLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground">Loading verification data...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
