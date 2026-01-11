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

export default function ListsPage() {
  useAuthGuard();
  const router = useRouter();

  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<List | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('liffy_token');

      const res = await fetch('/api/lists', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to fetch lists');

      const data = await res.json();
      
      // Safely handle response
      const listsArray = Array.isArray(data.lists) ? data.lists : [];
      
      // Normalize data with defaults
      const normalizedLists = listsArray.map((item: any) => ({
        id: item.id || '',
        name: item.name || 'Unnamed List',
        created_at: item.created_at || new Date().toISOString(),
        total_leads: Number(item.total_leads) || 0,
        verified_count: Number(item.verified_count) || 0,
        unverified_count: Number(item.unverified_count) || 0
      }));
      
      setLists(normalizedLists);
    } catch (e: any) {
      setError(e.message);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleCreate = async () => {
    if (!newListName.trim()) {
      setCreateError('List name is required');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const token = localStorage.getItem('liffy_token');

      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newListName.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create list');
      }

      const newList = await res.json();
      
      // Normalize the new list
      const normalizedNewList: List = {
        id: newList.id || '',
        name: newList.name || newListName.trim(),
        created_at: newList.created_at || new Date().toISOString(),
        total_leads: Number(newList.total_leads) || 0,
        verified_count: Number(newList.verified_count) || 0,
        unverified_count: Number(newList.unverified_count) || 0
      };
      
      setLists(prev => [normalizedNewList, ...prev]);
      setShowCreateModal(false);
      setNewListName('');
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);

    try {
      const token = localStorage.getItem('liffy_token');

      const res = await fetch(`/api/lists/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete list');

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
      {/* Header */}
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

      {/* Error State */}
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

      {/* Loading State */}
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

      {/* Empty State */}
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

      {/* Lists Table */}
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

      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => {
              setShowCreateModal(false);
              setNewListName('');
              setCreateError(null);
            }}
          />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
            <h2 className="text-lg font-semibold mb-4">Create New List</h2>
            
            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{createError}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                List Name
              </label>
              <Input
                placeholder="Enter list name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !createLoading) {
                    handleCreate();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewListName('');
                  setCreateError(null);
                }}
                disabled={createLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createLoading || !newListName.trim()}
              >
                {createLoading ? 'Creating...' : 'Create List'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
            <h2 className="text-lg font-semibold mb-2">Delete List</h2>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? 
              This will also remove all {formatNumber(deleteTarget.total_leads)} leads from this list. 
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
