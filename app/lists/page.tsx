'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthGuard } from '@/hooks/useAuthGuard';

interface List {
  id: string;
  name: string;
  created_at: string;
  total_leads: number;
  verified_count: number;
  unverified_count: number;
}

interface MiningJob {
  id: string;
  name: string;
  target_url: string | null;
  status: string;
  created_at: string;
  total_found: number;
  lead_count: number;
}

export default function ListsPage() {
  useAuthGuard();
  const router = useRouter();

  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countriesInput, setCountriesInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [sourceTypeMining, setSourceTypeMining] = useState(false);
  const [sourceTypeImport, setSourceTypeImport] = useState(false);
  const [sourceTypeManual, setSourceTypeManual] = useState(false);
  const [selectedMiningJob, setSelectedMiningJob] = useState('');
  const [emailOnly, setEmailOnly] = useState(true);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [miningJobs, setMiningJobs] = useState<MiningJob[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<List | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('liffy_token');
      const res = await fetch('/api/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch lists');

      const data = await res.json();
      const listsArray = Array.isArray(data.lists) ? data.lists : [];

      setLists(listsArray.map((item: any) => ({
        id: item.id || '',
        name: item.name || 'Unnamed List',
        created_at: item.created_at || new Date().toISOString(),
        total_leads: Number(item.total_leads) || 0,
        verified_count: Number(item.verified_count) || 0,
        unverified_count: Number(item.unverified_count) || 0
      })));
    } catch (e: any) {
      setError(e.message);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableTags = useCallback(async () => {
    try {
      const token = localStorage.getItem('liffy_token');
      const res = await fetch('/api/lists/tags', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(data.tags || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchMiningJobs = useCallback(async () => {
    try {
      const token = localStorage.getItem('liffy_token');
      const res = await fetch('/api/lists/mining-jobs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMiningJobs(data.jobs || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchLists();
    fetchAvailableTags();
    fetchMiningJobs();
  }, [fetchLists, fetchAvailableTags, fetchMiningJobs]);

  const parseCommaSeparated = (input: string): string[] => {
    return input.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  const getFilters = () => {
    const filters: Record<string, any> = {
      email_only: emailOnly
    };

    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;

    const countries = parseCommaSeparated(countriesInput);
    if (countries.length > 0) filters.countries = countries;

    const tags = parseCommaSeparated(tagsInput);
    if (tags.length > 0) filters.tags = tags;

    const sourceTypes: string[] = [];
    if (sourceTypeMining) sourceTypes.push('mining');
    if (sourceTypeImport) sourceTypes.push('import');
    if (sourceTypeManual) sourceTypes.push('manual');
    if (sourceTypes.length > 0) filters.source_types = sourceTypes;

    if (selectedMiningJob) filters.mining_job_id = selectedMiningJob;

    return filters;
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setCreateError(null);
    setPreviewCount(null);

    try {
      const token = localStorage.getItem('liffy_token');
      const filters = getFilters();

      const res = await fetch('/api/lists/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(filters)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to preview leads');
      }

      setPreviewCount(data.count);
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateEmpty = async () => {
    if (!newListName.trim()) {
      setCreateError('List name is required');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const token = localStorage.getItem('liffy_token');
      const res = await fetch('/api/lists/create-empty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newListName.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create list');
      }

      setLists(prev => [{
        id: data.id || '',
        name: data.name || newListName.trim(),
        created_at: data.created_at || new Date().toISOString(),
        total_leads: 0,
        verified_count: 0,
        unverified_count: 0
      }, ...prev]);

      resetCreateModal();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreateLoading(false);
    }
  };


  const handleCreate = async () => {
    if (!newListName.trim()) {
      setCreateError('List name is required');
      return;
    }

    if (previewCount === null) {
      setCreateError('Please preview leads first');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const token = localStorage.getItem('liffy_token');
      const filters = getFilters();

      const res = await fetch('/api/lists/create-with-filters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newListName.trim(),
          ...filters
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create list');
      }

      setLists(prev => [{
        id: data.id || '',
        name: data.name || newListName.trim(),
        created_at: data.created_at || new Date().toISOString(),
        total_leads: Number(data.total_leads) || 0,
        verified_count: Number(data.verified_count) || 0,
        unverified_count: Number(data.unverified_count) || 0
      }, ...prev]);

      resetCreateModal();
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setNewListName('');
    setDateFrom('');
    setDateTo('');
    setCountriesInput('');
    setTagsInput('');
    setSourceTypeMining(false);
    setSourceTypeImport(false);
    setSourceTypeManual(false);
    setSelectedMiningJob('');
    setEmailOnly(true);
    setPreviewCount(null);
    setCreateError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);

    try {
      const token = localStorage.getItem('liffy_token');
      const res = await fetch(`/api/lists/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete list');
      }

      setLists(prev => prev.filter(l => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRowClick = (listId: string) => {
    router.push(`/lists/${listId}`);
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${lists.length} list${lists.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          Create List
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchLists}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-muted-foreground">Loading lists...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && lists.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No lists yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first list to organize leads for campaigns.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                Create List
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && lists.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>List Name</TableHead>
                <TableHead>Total Leads</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Unverified</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map(list => (
                <TableRow
                  key={list.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(list.id)}
                >
                  <TableCell className="font-medium">{list.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{formatNumber(list.total_leads)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                      {formatNumber(list.verified_count)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatNumber(list.unverified_count)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(list.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(list.id);
                      }}
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(list);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={resetCreateModal} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-1">Create New List</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Filter your leads and create a targeted list for campaigns.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{createError}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* List Name */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  List Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g., Germany Water Companies Q1 2026"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="text-base"
                />
              </div>

              {/* Mining Job Selection */}
              <div className="p-4 border rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Mining Job
                </label>
                <select
                  value={selectedMiningJob}
                  onChange={(e) => setSelectedMiningJob(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All leads (no specific job)</option>
                  {miningJobs.length === 0 && (
                    <option value="" disabled>No mining jobs found</option>
                  )}
                  {miningJobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.name} • {job.lead_count} leads • {formatDate(job.created_at)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  Select a mining job to create a list from its results
                </p>
              </div>

              {/* Additional Filters */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-3">Additional Filters (optional)</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date From</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date To</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-1">Countries</label>
                  <Input
                    placeholder="Germany, France, Italy"
                    value={countriesInput}
                    onChange={(e) => setCountriesInput(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-1">Lead Tags</label>
                  <Input
                    placeholder="vip, hot-lead"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                  {availableTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {availableTags.slice(0, 8).map(tag => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted"
                          onClick={() => {
                            const current = parseCommaSeparated(tagsInput);
                            if (!current.includes(tag)) {
                              setTagsInput(current.length > 0 ? `${tagsInput}, ${tag}` : tag);
                            }
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-2">Source Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sourceTypeMining}
                        onChange={(e) => setSourceTypeMining(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Mining
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sourceTypeImport}
                        onChange={(e) => setSourceTypeImport(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Import
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sourceTypeManual}
                        onChange={(e) => setSourceTypeManual(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Manual
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emailOnly"
                    checked={emailOnly}
                    onChange={(e) => setEmailOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="emailOnly" className="text-sm text-gray-700">
                    Only include leads with email addresses
                  </label>
                </div>
              </div>

              {/* Preview Result */}
              {previewCount !== null && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-lg font-semibold text-blue-800">
                    {formatNumber(previewCount)} leads match your criteria
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Click "Create List" to save this selection
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 mt-6 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={resetCreateModal}
                disabled={createLoading || previewLoading}
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewLoading || createLoading}
                >
                  {previewLoading ? 'Counting...' : 'Preview Leads'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCreateEmpty}
                  disabled={createLoading || !newListName.trim()}
                >
                  Create Empty
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createLoading || previewLoading || !newListName.trim() || previewCount === null}
                >
                  {createLoading ? 'Creating...' : 'Create List'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
            <h2 className="text-lg font-semibold mb-2">Delete List</h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This will remove all {formatNumber(deleteTarget.total_leads)} leads from this list.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteLoading ? 'Deleting...' : 'Delete List'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
