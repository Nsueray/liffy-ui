'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.liffy.app';

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

interface CampaignHistory {
  id: string;
  name: string;
  status: string;
  created_at: string;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  replies: number;
  bounces: number;
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

interface ContactNote {
  id: string;
  content: string;
  user_email: string | null;
  created_at: string;
}

interface ContactActivity {
  id: string;
  activity_type: string;
  description: string | null;
  meta: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
}

interface ContactTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'normal' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  assigned_to_email: string | null;
  completed_at: string | null;
  created_at: string;
}

type TabKey = 'overview' | 'notes' | 'activities' | 'tasks';

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

const getActivityIcon = (type: string): string => {
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

const getPriorityBadgeClass = (priority: string): string => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 hover:bg-red-100';
    case 'normal': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    case 'low': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

const formatIntentType = (type: string): string => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatActivityType = (type: string): string => {
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

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Verify single
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Unsubscribe
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [unsubConfirm, setUnsubConfirm] = useState(false);
  const [unsubLoading, setUnsubLoading] = useState(false);

  // Campaign history
  const [campaignHistory, setCampaignHistory] = useState<CampaignHistory[]>([]);

  // Notes state
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);

  // Activities state
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<ContactTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [tasksError, setTasksError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('liffy_token');

  const fetchDetail = useCallback(async () => {
    const token = getToken();
    if (!token || !personId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}`, {
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
      // Check unsubscribe status
      const personEmail = data.person?.email || data.email;
      if (personEmail) {
        try {
          const unsubRes = await fetch(
            `${API_BASE}/api/unsubscribes/check?email=${encodeURIComponent(personEmail)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (unsubRes.ok) {
            const unsubData = await unsubRes.json();
            setIsUnsubscribed(!!unsubData.unsubscribed);
          }
        } catch { /* ignore */ }
      }

      // Fetch campaign history
      try {
        const campRes = await fetch(
          `${API_BASE}/api/persons/${personId}/campaigns`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (campRes.ok) {
          const campData = await campRes.json();
          setCampaignHistory(campData.campaigns || []);
        }
      } catch { /* ignore */ }
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

  // --- Notes ---
  const fetchNotes = useCallback(async () => {
    const token = getToken();
    if (!token || !personId) return;
    setNotesLoading(true);
    setNotesError(null);
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load notes');
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (e: unknown) {
      setNotesError(e instanceof Error ? e.message : 'Failed to load notes');
    } finally {
      setNotesLoading(false);
    }
  }, [personId]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newNote.trim() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add note');
      }
      setNewNote('');
      fetchNotes();
      fetchActivities();
    } catch (e: unknown) {
      setNotesError(e instanceof Error ? e.message : 'Failed to add note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete note');
      fetchNotes();
    } catch (e: unknown) {
      setNotesError(e instanceof Error ? e.message : 'Failed to delete note');
    }
  };

  // --- Activities ---
  const fetchActivities = useCallback(async () => {
    const token = getToken();
    if (!token || !personId) return;
    setActivitiesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/activities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load activities');
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      // silent
    } finally {
      setActivitiesLoading(false);
    }
  }, [personId]);

  // --- Tasks ---
  const fetchTasks = useCallback(async () => {
    const token = getToken();
    if (!token || !personId) return;
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e: unknown) {
      setTasksError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  }, [personId]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          due_date: newTaskDue || null,
          priority: newTaskPriority
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add task');
      }
      setNewTaskTitle('');
      setNewTaskDue('');
      setNewTaskPriority('normal');
      fetchTasks();
      fetchActivities();
    } catch (e: unknown) {
      setTasksError(e instanceof Error ? e.message : 'Failed to add task');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed' })
      });
      if (!res.ok) throw new Error('Failed to update task');
      fetchTasks();
      fetchActivities();
    } catch (e: unknown) {
      setTasksError(e instanceof Error ? e.message : 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete task');
      fetchTasks();
    } catch (e: unknown) {
      setTasksError(e instanceof Error ? e.message : 'Failed to delete task');
    }
  };

  // Tab load triggers
  useEffect(() => {
    if (!personId) return;
    if (activeTab === 'notes') fetchNotes();
    if (activeTab === 'activities') fetchActivities();
    if (activeTab === 'tasks') fetchTasks();
  }, [activeTab, personId, fetchNotes, fetchActivities, fetchTasks]);

  const handleVerify = async () => {
    if (!detail) return;
    const token = getToken();
    if (!token) return;

    setVerifyLoading(true);
    setVerifyResult(null);
    setVerifyError(null);

    try {
      const res = await fetch(`${API_BASE}/api/verification/verify-single`, {
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
      const res = await fetch(`${API_BASE}/api/persons/${personId}`, {
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

  const handleUnsubscribe = async () => {
    if (!detail) return;
    const token = getToken();
    if (!token) return;

    setUnsubLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/unsubscribes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: detail.person.email, reason: 'user_request' })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Unsubscribe failed');
      }

      setIsUnsubscribed(true);
      setUnsubConfirm(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unsubscribe failed';
      alert(msg);
    } finally {
      setUnsubLoading(false);
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

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'notes', label: 'Notes', count: notes.length },
    { key: 'activities', label: 'Activities', count: activities.length },
    { key: 'tasks', label: 'Tasks', count: tasks.filter(t => t.status === 'pending').length },
  ];

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
          {isUnsubscribed ? (
            <Button variant="outline" size="sm" disabled className="text-red-500 border-red-200">
              Unsubscribed
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnsubConfirm(true)}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              Unsubscribe
            </Button>
          )}
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

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'ml-2 px-2 py-0.5 text-xs rounded-full',
                  activeTab === tab.key
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
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

          {/* Campaign History */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Campaign History ({campaignHistory.length})
              </h3>
              {campaignHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No campaigns sent to this contact.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Sent</TableHead>
                        <TableHead className="text-center">Delivered</TableHead>
                        <TableHead className="text-center">Opened</TableHead>
                        <TableHead className="text-center">Clicked</TableHead>
                        <TableHead className="text-center">Replied</TableHead>
                        <TableHead className="text-center">Bounced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaignHistory.map(c => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50"
                          onClick={() => router.push(`/campaigns/${c.id}`)}>
                          <TableCell className="font-medium text-sm">{c.name || 'Unnamed'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              'text-xs',
                              c.status === 'completed' && 'bg-green-50 text-green-700',
                              c.status === 'sending' && 'bg-blue-50 text-blue-700',
                              c.status === 'failed' && 'bg-red-50 text-red-700',
                            )}>{c.status}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{c.sent > 0 ? '✅' : '—'}</TableCell>
                          <TableCell className="text-center">{c.delivered > 0 ? '✅' : '—'}</TableCell>
                          <TableCell className="text-center">{c.opens > 0 ? '✅' : '—'}</TableCell>
                          <TableCell className="text-center">{c.clicks > 0 ? '✅' : '—'}</TableCell>
                          <TableCell className="text-center">{c.replies > 0 ? '✅' : '—'}</TableCell>
                          <TableCell className="text-center">{c.bounces > 0 ? '❌' : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

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
      )}

      {/* NOTES TAB */}
      {activeTab === 'notes' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note about this contact..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
              />
              <div className="flex items-center justify-between">
                {notesError && <p className="text-xs text-red-600">{notesError}</p>}
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="ml-auto bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Add Note
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              {notesLoading ? (
                <p className="text-sm text-muted-foreground">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map(n => (
                    <div key={n.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap flex-1">{n.content}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNote(n.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                        >
                          Delete
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>{n.user_email || 'Unknown'}</span>
                        <span>•</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ACTIVITIES TAB */}
      {activeTab === 'activities' && (
        <Card>
          <CardContent className="pt-6">
            {activitiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading activities...</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                    <div className="text-2xl flex-shrink-0">{getActivityIcon(a.activity_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {formatActivityType(a.activity_type)}
                        </p>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(a.occurred_at).toLocaleString()}
                        </span>
                      </div>
                      {a.description && (
                        <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TASKS TAB */}
      {activeTab === 'tasks' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Add task form */}
            <div className="space-y-2 border-b pb-4">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={e => setNewTaskDue(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <select
                  value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value as 'low' | 'normal' | 'high')}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
                <Button
                  size="sm"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="ml-auto bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Add Task
                </Button>
              </div>
              {tasksError && <p className="text-xs text-red-600">{tasksError}</p>}
            </div>

            {/* Task list */}
            {tasksLoading ? (
              <p className="text-sm text-muted-foreground">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(t => {
                  const overdue = t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date();
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        'p-3 rounded-lg border',
                        t.status === 'completed' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200',
                        overdue && 'border-red-300 bg-red-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={t.status === 'completed'}
                          onChange={() => t.status !== 'completed' && handleCompleteTask(t.id)}
                          disabled={t.status === 'completed'}
                          className="mt-1 h-4 w-4 accent-orange-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-medium',
                            t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'
                          )}>
                            {t.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                            <Badge className={getPriorityBadgeClass(t.priority)}>
                              {t.priority}
                            </Badge>
                            {t.due_date && (
                              <span className={overdue ? 'text-red-600 font-medium' : ''}>
                                Due: {new Date(t.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {t.assigned_to_email && (
                              <span>• {t.assigned_to_email}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Unsubscribe Confirmation Dialog */}
      {unsubConfirm && detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Unsubscribe Contact</h3>
            <p className="text-sm text-gray-600 mb-1">
              Unsubscribe <strong>{detail.person.email}</strong>?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              This contact will be excluded from all future campaigns. This action cannot be undone from the UI.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setUnsubConfirm(false)} disabled={unsubLoading}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUnsubscribe}
                disabled={unsubLoading}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {unsubLoading ? 'Processing...' : 'Confirm Unsubscribe'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
