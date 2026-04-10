'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.liffy.app';

interface TaskItem {
  id: string;
  person_id: string;
  person_email: string | null;
  person_first_name: string | null;
  person_last_name: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'normal' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  assigned_to_email: string | null;
  completed_at: string | null;
  created_at: string;
}

type DueFilter = 'all' | 'overdue' | 'today' | 'upcoming';
type StatusFilter = 'pending' | 'completed' | 'all';

const getPriorityBadgeClass = (priority: string): string => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 hover:bg-red-100';
    case 'normal': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    case 'low': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
  }
};

const formatPersonName = (t: TaskItem): string => {
  const parts = [t.person_first_name, t.person_last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return t.person_email || 'Unknown';
};

export default function TasksPage() {
  useAuthGuard();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dueFilter, setDueFilter] = useState<DueFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const getToken = () => localStorage.getItem('liffy_token');

  const fetchTasks = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('due', dueFilter);
      params.set('assigned_to', 'me');

      const res = await fetch(`${API_BASE}/api/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [dueFilter, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update task');
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
      setError(e instanceof Error ? e.message : 'Failed to delete task');
    }
  };

  const dueFilters: { key: DueFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
  ];

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">Follow-up tasks assigned to you</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Status</p>
            <div className="flex gap-1">
              {statusFilters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md border transition-colors',
                    statusFilter === f.key
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Due</p>
            <div className="flex gap-1">
              {dueFilters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setDueFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md border transition-colors',
                    dueFilter === f.key
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchTasks}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task List */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No tasks match the current filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => {
                const overdue = t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date();
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'p-4 rounded-lg border',
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
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            'text-sm font-medium',
                            t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'
                          )}>
                            {t.title}
                          </p>
                        </div>

                        {t.person_id && (
                          <Link
                            href={`/leads/${t.person_id}`}
                            className="inline-block mt-1 text-xs text-blue-600 hover:underline"
                          >
                            {formatPersonName(t)}
                          </Link>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                          <Badge className={getPriorityBadgeClass(t.priority)}>
                            {t.priority}
                          </Badge>
                          {t.due_date && (
                            <span className={overdue ? 'text-red-600 font-medium' : ''}>
                              Due: {new Date(t.due_date).toLocaleDateString()}
                            </span>
                          )}
                          <span>• Created {new Date(t.created_at).toLocaleDateString()}</span>
                        </div>

                        {t.description && (
                          <p className="text-sm text-gray-600 mt-2">{t.description}</p>
                        )}
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
    </div>
  );
}
