'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.liffy.app';

interface BoardPerson {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  position: string | null;
  pipeline_entered_at: string | null;
  last_activity_type: string | null;
  last_activity_at: string | null;
}

interface BoardStage {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  count: number;
  people: BoardPerson[];
}

interface BoardResponse {
  stages: BoardStage[];
  total_people: number;
}

const LOST_REASONS: { value: string; label: string }[] = [
  { value: 'company_defunct', label: 'Company defunct' },
  { value: 'no_trade_fairs', label: "Doesn't attend trade fairs" },
  { value: 'bad_contact_info', label: 'Invalid contact info' },
  { value: 'unreachable', label: 'Unreachable' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'no_budget', label: 'Insufficient budget' },
  { value: 'competitor', label: 'Competitor event' },
  { value: 'wrong_profile', label: 'Wrong profile' },
  { value: 'bad_timing', label: 'Bad timing' },
  { value: 'other', label: 'Other' },
];

const getActivityIcon = (type: string | null): string => {
  if (!type) return '';
  switch (type) {
    case 'note_added': return '📝';
    case 'email_sent': return '📤';
    case 'email_replied': return '💬';
    case 'email_opened': return '👁';
    case 'call': return '📞';
    case 'meeting': return '🤝';
    case 'status_change': return '🔄';
    case 'zoho_pushed': return '☁️';
    case 'task_created': return '➕';
    case 'task_completed': return '✅';
    default: return '•';
  }
};

// Relative time: "3d ago", "2h ago", "just now"
const timeAgo = (iso: string | null): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60 * 1000) return 'just now';
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const personDisplayName = (p: BoardPerson): string => {
  const parts = [p.first_name, p.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return p.email;
};

export default function PipelinePage() {
  useAuthGuard();

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Lost reason modal state
  const [lostModal, setLostModal] = useState<{ personId: string; stageId: string } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [lostNote, setLostNote] = useState('');
  const [lostSubmitting, setLostSubmitting] = useState(false);

  const getToken = () => localStorage.getItem('liffy_token');

  const fetchBoard = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/pipeline/board?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: BoardResponse = await res.json();
      setBoard(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const doMoveStage = async (personId: string, stageId: string, reason?: string, reasonNote?: string) => {
    const token = getToken();
    if (!token) return;
    setMovingId(personId);
    try {
      const body: Record<string, string> = { stage_id: stageId };
      if (reason) body.reason = reason;
      if (reasonNote) body.reason_note = reasonNote;
      const res = await fetch(`${API_BASE}/api/persons/${personId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to move');
      }
      await fetchBoard();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to move');
    } finally {
      setMovingId(null);
    }
  };

  const handleMoveStage = (personId: string, stageId: string) => {
    const targetStage = stages.find(s => s.id === stageId);
    if (targetStage?.is_lost) {
      setLostReason('');
      setLostNote('');
      setLostModal({ personId, stageId });
      return;
    }
    doMoveStage(personId, stageId);
  };

  const handleLostConfirm = async () => {
    if (!lostModal || !lostReason) return;
    if (lostReason === 'other' && !lostNote.trim()) return;
    setLostSubmitting(true);
    await doMoveStage(
      lostModal.personId,
      lostModal.stageId,
      lostReason,
      lostReason === 'other' ? lostNote.trim() : undefined,
    );
    setLostSubmitting(false);
    setLostModal(null);
  };

  const handleLostCancel = () => {
    setLostModal(null);
    setLostReason('');
    setLostNote('');
  };

  // Summary counts
  const stages = board?.stages || [];
  const totalPeople = board?.total_people || 0;
  const wonCount = stages.filter(s => s.is_won).reduce((sum, s) => sum + s.count, 0);
  const lostCount = stages.filter(s => s.is_lost).reduce((sum, s) => sum + s.count, 0);
  const activeCount = totalPeople - wonCount - lostCount;

  const canConfirmLost = lostReason && (lostReason !== 'other' || lostNote.trim());

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Sales Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drag contacts through stages with the dropdown on each card
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total in Pipeline</p>
            <p className="text-2xl font-bold">{totalPeople.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-blue-600">{activeCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Won</p>
            <p className="text-2xl font-bold text-green-600">{wonCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Lost</p>
            <p className="text-2xl font-bold text-red-600">{lostCount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchBoard}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No pipeline stages configured yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="flex gap-4 min-w-max pb-4">
            {stages.map(stage => (
              <div key={stage.id} className="w-72 flex-shrink-0">
                {/* Column header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="font-semibold text-gray-900 text-sm">{stage.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {stage.count}
                    </span>
                  </div>
                </div>

                {/* Column body */}
                <div
                  className="bg-gray-50 rounded-lg p-2 space-y-2 min-h-[200px]"
                  style={{
                    borderTop: `3px solid ${stage.color}`,
                  }}
                >
                  {stage.people.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">No contacts</p>
                  ) : (
                    stage.people.map(person => (
                      <div
                        key={person.id}
                        className={cn(
                          'bg-white rounded-md border border-gray-200 p-3 hover:shadow-sm transition-shadow',
                          movingId === person.id && 'opacity-50'
                        )}
                      >
                        <Link
                          href={`/leads/${person.id}`}
                          className="block hover:text-orange-600"
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {personDisplayName(person)}
                          </p>
                          {person.email !== personDisplayName(person) && (
                            <p className="text-xs text-gray-500 truncate">{person.email}</p>
                          )}
                        </Link>

                        {person.company_name && (
                          <p className="text-xs text-gray-600 mt-1 truncate">
                            {person.company_name}
                            {person.position ? ` · ${person.position}` : ''}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                          <span>{timeAgo(person.pipeline_entered_at)}</span>
                          {person.last_activity_type && (
                            <span title={person.last_activity_type}>
                              {getActivityIcon(person.last_activity_type)}{' '}
                              {timeAgo(person.last_activity_at)}
                            </span>
                          )}
                        </div>

                        {/* Stage selector */}
                        <select
                          value={stage.id}
                          disabled={movingId === person.id}
                          onChange={(e) => {
                            if (e.target.value !== stage.id) {
                              handleMoveStage(person.id, e.target.value);
                            }
                          }}
                          className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          {stages.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {lostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Disqualification Reason</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Specify why this contact was disqualified.
            </p>

            <select
              value={lostReason}
              onChange={(e) => {
                setLostReason(e.target.value);
                if (e.target.value !== 'other') setLostNote('');
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Select reason...</option>
              {LOST_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {lostReason === 'other' && (
              <textarea
                value={lostNote}
                onChange={(e) => setLostNote(e.target.value)}
                placeholder="Provide details..."
                rows={3}
                className="mt-3 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
              />
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLostCancel}
                disabled={lostSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleLostConfirm}
                disabled={!canConfirmLost || lostSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {lostSubmitting ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
