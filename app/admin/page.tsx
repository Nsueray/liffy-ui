'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.liffy.app';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('liffy_token') : null;

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
  daily_email_limit: number;
  reports_to: string | null;
  manager_id: string | null;
  created_at: string;
}

interface UserStats {
  user: { id: string; email: string; role: string; daily_email_limit: number };
  email_usage: { sent_today: number; daily_limit: number; remaining: number };
  campaigns: { total: number; sending: number; completed: number };
  mining_jobs: { total: number; completed: number; running: number };
  tasks: { pending: number; overdue: number; completed: number };
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    manager: 'bg-indigo-100 text-indigo-700',
    sales_rep: 'bg-green-100 text-green-700',
    staff: 'bg-gray-100 text-gray-700',
    user: 'bg-green-100 text-green-700',
  };
  const labels: Record<string, string> = {
    sales_rep: 'Sales Rep',
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Manager',
    staff: 'Staff',
    user: 'User',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${map[role] || 'bg-gray-100 text-gray-700'}`}>
      {labels[role] || role}
    </span>
  );
}

function statusBadge(active: boolean) {
  return active
    ? <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
    : <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Inactive</span>;
}

export default function AdminPage() {
  useAuthGuard();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<User | null>(null);
  const [showReset, setShowReset] = useState<User | null>(null);
  const [expandedStats, setExpandedStats] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<Record<string, UserStats>>({});
  const [statsLoading, setStatsLoading] = useState<string | null>(null);

  // Form states — Add
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [addRole, setAddRole] = useState('sales_rep');
  const [addLimit, setAddLimit] = useState('1000');
  const [addReportsTo, setAddReportsTo] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Form states — Edit
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editReportsTo, setEditReportsTo] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Form states — Reset Password
  const [resetPw, setResetPw] = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Auth guard — redirect non-privileged
  useEffect(() => {
    try {
      const raw = localStorage.getItem('liffy_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        const u = parsed.user || parsed;
        const role = u.role || '';
        const userId = u.user_id || u.id || '';
        setCurrentRole(role);
        setCurrentUserId(userId);
        if (role !== 'owner' && role !== 'admin') {
          router.replace('/dashboard');
        }
      }
    } catch {
      router.replace('/dashboard');
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) { router.replace('/dashboard'); return; }
        throw new Error('Failed to load users');
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Fetch stats for a user
  const fetchStats = async (userId: string) => {
    if (statsData[userId]) { setExpandedStats(userId); return; }
    const token = getToken();
    if (!token) return;
    setStatsLoading(userId);
    try {
      const res = await fetch(`${apiBase}/api/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatsData(prev => ({ ...prev, [userId]: data }));
        setExpandedStats(userId);
      }
    } catch {} finally {
      setStatsLoading(null);
    }
  };

  // Add User
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (addPassword.length < 8) { setAddError('Password must be at least 8 characters'); return; }
    const token = getToken();
    if (!token) return;
    setAddLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: addEmail,
          password: addPassword,
          role: addRole,
          first_name: addFirstName || undefined,
          last_name: addLastName || undefined,
          daily_email_limit: parseInt(addLimit, 10) || 1000,
          reports_to: addReportsTo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || 'Failed to create user'); return; }
      setShowAdd(false);
      setAddEmail(''); setAddPassword(''); setAddFirstName(''); setAddLastName('');
      setAddRole('sales_rep'); setAddLimit('1000'); setAddReportsTo('');
      fetchUsers();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // Edit User
  const openEdit = (u: User) => {
    setShowEdit(u);
    setEditFirstName(u.first_name || '');
    setEditLastName(u.last_name || '');
    setEditRole(u.role);
    setEditLimit(String(u.daily_email_limit || 0));
    setEditReportsTo(u.reports_to || u.manager_id || '');
    setEditActive(u.is_active);
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    setEditError('');
    const token = getToken();
    if (!token) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/users/${showEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          role: editRole,
          daily_email_limit: parseInt(editLimit, 10) || 0,
          reports_to: editReportsTo || null,
          is_active: editActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update user'); return; }
      setShowEdit(null);
      fetchUsers();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Reset Password
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReset) return;
    setResetError(''); setResetSuccess(false);
    if (resetPw.length < 8) { setResetError('Password must be at least 8 characters'); return; }
    if (resetPw !== resetPwConfirm) { setResetError('Passwords do not match'); return; }
    const token = getToken();
    if (!token) return;
    setResetLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/users/${showReset.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: resetPw }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error || 'Failed to reset password'); return; }
      setResetSuccess(true);
      setResetPw(''); setResetPwConfirm('');
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  if (currentRole !== 'owner' && currentRole !== 'admin') {
    return null; // redirect happening
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage team members and their permissions</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddError(''); }}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
        >
          + Add User
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}

      {/* Users Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Reports To</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Daily Limit</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <>
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {u.first_name || u.last_name
                        ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                        : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">{roleBadge(u.role)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {(() => {
                        const mgr = users.find(m => m.id === (u.reports_to || u.manager_id));
                        return mgr ? `${mgr.first_name || ''} ${mgr.last_name || mgr.email}`.trim() : <span className="text-gray-300">-</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">{statusBadge(u.is_active)}</td>
                    <td className="px-4 py-3 text-gray-600">{u.daily_email_limit?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          if (expandedStats === u.id) { setExpandedStats(null); }
                          else { fetchStats(u.id); }
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        {statsLoading === u.id ? '...' : expandedStats === u.id ? 'Hide Stats' : 'Stats'}
                      </button>
                      <button
                        onClick={() => openEdit(u)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setShowReset(u); setResetPw(''); setResetPwConfirm(''); setResetError(''); setResetSuccess(false); }}
                        className="text-xs text-orange-600 hover:text-orange-800 underline"
                      >
                        Reset PW
                      </button>
                    </td>
                  </tr>
                  {/* Expanded Stats Row */}
                  {expandedStats === u.id && statsData[u.id] && (
                    <tr key={`${u.id}-stats`} className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <StatsPanel stats={statsData[u.id]} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD USER MODAL */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Add New User</h3>
            {addError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{addError}</div>}
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" required value={addEmail} onChange={e => setAddEmail(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="user@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password * <span className="text-gray-400 font-normal">(min 8 chars)</span></label>
                <input type="password" required minLength={8} value={addPassword} onChange={e => setAddPassword(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input type="text" value={addFirstName} onChange={e => setAddFirstName(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input type="text" value={addLastName} onChange={e => setAddLastName(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select value={addRole} onChange={e => setAddRole(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm">
                    <option value="sales_rep">Sales Rep</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    {currentRole === 'owner' && <option value="owner">Owner</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Daily Email Limit</label>
                  <input type="number" min={0} value={addLimit} onChange={e => setAddLimit(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reports To</label>
                <select value={addReportsTo} onChange={e => setAddReportsTo(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">None (top-level)</option>
                  {users.filter(u => u.id !== currentUserId || u.role === 'owner').map(u => (
                    <option key={u.id} value={u.id}>
                      {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Cancel</button>
                <button type="submit" disabled={addLoading}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 text-sm">
                  {addLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Edit User</h3>
            <p className="text-sm text-gray-500 mb-4">{showEdit.email}</p>
            {editError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{editError}</div>}
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={showEdit.id === currentUserId && showEdit.role === 'owner'}
                  >
                    <option value="sales_rep">Sales Rep</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="user">User (legacy)</option>
                    <option value="admin">Admin (legacy)</option>
                    {currentRole === 'owner' && <option value="owner">Owner</option>}
                  </select>
                  {showEdit.id === currentUserId && showEdit.role === 'owner' && (
                    <p className="text-xs text-gray-400 mt-1">Cannot change own owner role</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Daily Email Limit</label>
                  <input type="number" min={0} value={editLimit} onChange={e => setEditLimit(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reports To</label>
                <select value={editReportsTo} onChange={e => setEditReportsTo(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">None (top-level)</option>
                  {users.filter(u => u.id !== showEdit?.id).map(u => (
                    <option key={u.id} value={u.id}>
                      {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Active</label>
                <button
                  type="button"
                  onClick={() => setEditActive(!editActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editActive ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-500">{editActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowEdit(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Cancel</button>
                <button type="submit" disabled={editLoading}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 text-sm">
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">{showReset.email}</p>
            {resetError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{resetError}</div>}
            {resetSuccess && <div className="bg-green-50 text-green-600 p-2 text-sm rounded mb-4">Password reset successfully</div>}
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Password <span className="text-gray-400 font-normal">(min 8 chars)</span></label>
                <input type="password" required minLength={8} value={resetPw} onChange={e => setResetPw(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm Password</label>
                <input type="password" required minLength={8} value={resetPwConfirm} onChange={e => setResetPwConfirm(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowReset(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm">Close</button>
                <button type="submit" disabled={resetLoading}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 text-sm">
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Stats sub-component
function StatsPanel({ stats }: { stats: UserStats }) {
  const { email_usage, campaigns, mining_jobs, tasks } = stats;
  const pct = email_usage.daily_limit > 0
    ? Math.round((email_usage.sent_today / email_usage.daily_limit) * 100)
    : 0;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Email Usage */}
      <div className="bg-white rounded-lg border p-3">
        <p className="text-xs text-gray-500 mb-1">Email Usage Today</p>
        <p className="text-lg font-semibold">{email_usage.sent_today} <span className="text-sm font-normal text-gray-400">/ {email_usage.daily_limit.toLocaleString()}</span></p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">{email_usage.remaining.toLocaleString()} remaining</p>
      </div>
      {/* Campaigns */}
      <div className="bg-white rounded-lg border p-3">
        <p className="text-xs text-gray-500 mb-1">Campaigns</p>
        <p className="text-lg font-semibold">{campaigns.total}</p>
        <div className="flex gap-2 text-xs text-gray-500 mt-1">
          <span>{campaigns.sending} sending</span>
          <span>{campaigns.completed} done</span>
        </div>
      </div>
      {/* Mining Jobs */}
      <div className="bg-white rounded-lg border p-3">
        <p className="text-xs text-gray-500 mb-1">Mining Jobs</p>
        <p className="text-lg font-semibold">{mining_jobs.total}</p>
        <div className="flex gap-2 text-xs text-gray-500 mt-1">
          <span>{mining_jobs.running} running</span>
          <span>{mining_jobs.completed} done</span>
        </div>
      </div>
      {/* Tasks */}
      <div className="bg-white rounded-lg border p-3">
        <p className="text-xs text-gray-500 mb-1">Tasks</p>
        <p className="text-lg font-semibold">{tasks.pending + tasks.completed}</p>
        <div className="flex gap-2 text-xs text-gray-500 mt-1">
          <span>{tasks.pending} pending</span>
          {tasks.overdue > 0 && <span className="text-red-500">{tasks.overdue} overdue</span>}
        </div>
      </div>
    </div>
  );
}
