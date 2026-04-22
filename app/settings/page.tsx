'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';

interface Sender {
  id: string;
  label: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  is_active: boolean;
  visibility: 'shared' | 'private';
  campaign_count: number;
}

export default function SettingsPage() {
  useAuthGuard();

  // States for API Key
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // States for Senders
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderLoading, setSenderLoading] = useState(false);

  // Create Sender Form
  const [showSenderModal, setShowSenderModal] = useState(false);
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderVisibility, setNewSenderVisibility] = useState<'shared' | 'private'>('shared');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Sender
  const [editingSender, setEditingSender] = useState<Sender | null>(null);
  const [editName, setEditName] = useState('');
  const [editReplyTo, setEditReplyTo] = useState('');
  const [editVisibility, setEditVisibility] = useState<'shared' | 'private'>('shared');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Sender
  const [deletingSender, setDeletingSender] = useState<Sender | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // States for ZeroBounce
  const [zbKey, setZbKey] = useState('');
  const [zbMaskedKey, setZbMaskedKey] = useState('');
  const [hasZbKey, setHasZbKey] = useState(false);
  const [zbLoading, setZbLoading] = useState(false);
  const [zbMessage, setZbMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [zbShowKey, setZbShowKey] = useState(false);
  const [zbCredits, setZbCredits] = useState<number | null>(null);
  const [zbCreditsLoading, setZbCreditsLoading] = useState(false);

  // States for Zoho CRM
  const [zohoClientId, setZohoClientId] = useState('');
  const [zohoClientSecret, setZohoClientSecret] = useState('');
  const [zohoRefreshToken, setZohoRefreshToken] = useState('');
  const [zohoDatacenter, setZohoDatacenter] = useState('com');
  const [hasZoho, setHasZoho] = useState(false);
  const [zohoMaskedClientId, setZohoMaskedClientId] = useState('');
  const [zohoOrgName, setZohoOrgName] = useState('');
  const [zohoLoading, setZohoLoading] = useState(false);
  const [zohoRemoveLoading, setZohoRemoveLoading] = useState(false);
  const [zohoMessage, setZohoMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [zohoShowSecrets, setZohoShowSecrets] = useState(false);

  // States for Reply Detection Health
  const [replyHealth, setReplyHealth] = useState<any>(null);
  const [replyTestLoading, setReplyTestLoading] = useState(false);
  const [replyTestMessage, setReplyTestMessage] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";
  const getToken = () => localStorage.getItem('liffy_token');

  // --- FETCH DATA ---
  const fetchSettings = useCallback(async () => {
    const token = getToken();
    if(!token) return;

    try {
      // 1. Get Settings (API Key + ZeroBounce + Zoho status)
      const settingsRes = await fetch(`${apiBase}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(settingsRes.ok) {
        const data = await settingsRes.json();
        setHasKey(data.settings.has_api_key);
        setMaskedKey(data.settings.masked_api_key);
        setHasZbKey(data.settings.has_zerobounce_key);
        setZbMaskedKey(data.settings.masked_zerobounce_key || '');
        setHasZoho(data.settings.has_zoho);
        setZohoDatacenter(data.settings.zoho_datacenter || 'com');
        setZohoMaskedClientId(data.settings.masked_zoho_client_id || '');
      }

      // 2. Get Senders
      const sendersRes = await fetch(`${apiBase}/api/senders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(sendersRes.ok) {
        const data = await sendersRes.json();
        setSenders(data.items || []);
      }

      // 3. Get Reply Health
      try {
        const rhRes = await fetch(`${apiBase}/api/settings/reply-health`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (rhRes.ok) {
          setReplyHealth(await rhRes.json());
        }
      } catch { /* ignore */ }
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // --- HANDLERS: SENDGRID API KEY ---
  const handleSaveKey = async () => {
    if (!apiKey.startsWith('SG.')) {
      setKeyMessage({ type: 'error', text: 'Invalid Key. Must start with "SG."' });
      return;
    }

    setKeyLoading(true);
    setKeyMessage(null);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/settings/apikey`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ api_key: apiKey })
      });

      if (!res.ok) throw new Error("Failed to save key");

      setHasKey(true);
      setMaskedKey('...' + apiKey.slice(-4));
      setApiKey('');
      setKeyMessage({ type: 'success', text: 'SendGrid API Key saved successfully!' });
    } catch (err) {
      setKeyMessage({ type: 'error', text: 'Failed to save API Key' });
    } finally {
      setKeyLoading(false);
    }
  };

  // --- HANDLERS: SENDERS ---
  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/senders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          from_name: newSenderName,
          from_email: newSenderEmail,
          label: `${newSenderName} (${newSenderEmail})`,
          is_default: senders.length === 0,
          visibility: newSenderVisibility
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add sender");

      setSenders([data.sender, ...senders]);
      setShowSenderModal(false);
      setNewSenderName('');
      setNewSenderEmail('');
      setNewSenderVisibility('shared');
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // --- HANDLERS: EDIT SENDER ---
  const openEditModal = (s: Sender) => {
    setEditingSender(s);
    setEditName(s.from_name);
    setEditReplyTo(s.reply_to || '');
    setEditVisibility(s.visibility);
    setEditError(null);
  };

  const handleEditSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSender) return;
    setEditLoading(true);
    setEditError(null);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/senders/${editingSender.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          from_name: editName,
          reply_to: editReplyTo || null,
          visibility: editVisibility,
          label: `${editName} (${editingSender.from_email})`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update sender");

      setSenders(prev => prev.map(s => s.id === editingSender.id ? { ...s, ...data.sender } : s));
      setEditingSender(null);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // --- HANDLERS: DELETE SENDER ---
  const handleDeleteSender = async () => {
    if (!deletingSender) return;
    setDeleteLoading(true);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/senders/${deletingSender.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete sender");
      }

      setSenders(prev => prev.filter(s => s.id !== deletingSender.id));
      setDeletingSender(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- HANDLERS: ZEROBOUNCE ---
  const handleSaveZbKey = async () => {
    if (!zbKey || zbKey.trim().length < 10) {
      setZbMessage({ type: 'error', text: 'API key must be at least 10 characters.' });
      return;
    }

    setZbLoading(true);
    setZbMessage(null);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/settings/zerobounce-key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ api_key: zbKey })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save ZeroBounce key");

      setHasZbKey(true);
      setZbMaskedKey('...' + zbKey.slice(-4));
      setZbCredits(data.credits ?? null);
      setZbKey('');
      setZbShowKey(false);
      setZbMessage({ type: 'success', text: `ZeroBounce API Key saved! Credits: ${data.credits ?? 'unknown'}` });
    } catch (err: any) {
      setZbMessage({ type: 'error', text: err.message });
    } finally {
      setZbLoading(false);
    }
  };

  const handleCheckCredits = async () => {
    setZbCreditsLoading(true);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/verification/credits`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check credits");

      setZbCredits(data.credits);
      setZbMessage({ type: 'success', text: `Credit balance: ${data.credits}` });
    } catch (err: any) {
      setZbMessage({ type: 'error', text: err.message });
    } finally {
      setZbCreditsLoading(false);
    }
  };

  // --- HANDLERS: ZOHO CRM ---
  const handleSaveZoho = async () => {
    if (!zohoClientId || !zohoClientSecret || !zohoRefreshToken) {
      setZohoMessage({ type: 'error', text: 'All three fields (Client ID, Client Secret, Refresh Token) are required.' });
      return;
    }

    setZohoLoading(true);
    setZohoMessage(null);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/settings/zoho`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: zohoClientId,
          client_secret: zohoClientSecret,
          refresh_token: zohoRefreshToken,
          datacenter: zohoDatacenter
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Zoho credentials");

      setHasZoho(true);
      setZohoMaskedClientId('...' + zohoClientId.slice(-4));
      setZohoOrgName(data.org_name || '');
      setZohoClientId('');
      setZohoClientSecret('');
      setZohoRefreshToken('');
      setZohoShowSecrets(false);
      setZohoMessage({ type: 'success', text: `Connected to Zoho CRM${data.org_name ? ` (${data.org_name})` : ''}!` });
    } catch (err: any) {
      setZohoMessage({ type: 'error', text: err.message });
    } finally {
      setZohoLoading(false);
    }
  };

  const handleRemoveZoho = async () => {
    if (!confirm('Are you sure you want to disconnect Zoho CRM? This will remove all stored credentials.')) {
      return;
    }

    setZohoRemoveLoading(true);
    setZohoMessage(null);
    const token = getToken();

    try {
      const res = await fetch(`${apiBase}/api/settings/zoho`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to remove Zoho credentials");

      setHasZoho(false);
      setZohoMaskedClientId('');
      setZohoOrgName('');
      setZohoDatacenter('com');
      setZohoMessage({ type: 'success', text: 'Zoho CRM disconnected.' });
    } catch (err: any) {
      setZohoMessage({ type: 'error', text: err.message });
    } finally {
      setZohoRemoveLoading(false);
    }
  };

  // --- HANDLERS: REPLY TEST ---
  const handleReplyTest = async () => {
    const token = getToken();
    if (!token) return;
    setReplyTestLoading(true);
    setReplyTestMessage(null);
    try {
      const res = await fetch(`${apiBase}/api/settings/reply-test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send test');
      }
      const data = await res.json();
      setReplyTestMessage(data.message);

      // Auto-refresh reply health after 30 seconds to check for test reply
      setTimeout(async () => {
        try {
          const rhRes = await fetch(`${apiBase}/api/settings/reply-health`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (rhRes.ok) {
            const rh = await rhRes.json();
            setReplyHealth(rh);
            if (rh.test_reply_received) {
              setReplyTestMessage('Reply detection is working! Test reply received.');
            }
          }
        } catch { /* ignore */ }
      }, 30000);
    } catch (err: any) {
      setReplyTestMessage(`Error: ${err.message}`);
    } finally {
      setReplyTestLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your email infrastructure, verification, and integrations.</p>
        </div>
        <a href="/admin" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
          Manage Users &rarr;
        </a>
      </div>

      {/* SECTION 1: SENDGRID API KEY */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Email Service Provider (SendGrid)</h2>
        <div className="max-w-xl">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SendGrid API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? `Stored: ${maskedKey}` : "Starts with SG..."}
              className="flex-1 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleSaveKey}
              disabled={keyLoading || !apiKey}
              className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {keyLoading ? 'Saving...' : 'Save Key'}
            </button>
          </div>
          {keyMessage && (
            <p className={`text-xs mt-2 ${keyMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {keyMessage.text}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            This key is used to send all emails. It is stored securely on the server.
          </p>
        </div>
      </div>

      {/* SECTION 2: SENDER IDENTITIES */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Sender Identities</h2>
            <p className="text-sm text-gray-500">Who will your emails come from?</p>
          </div>
          <button
            onClick={() => setShowSenderModal(true)}
            className="px-3 py-1.5 border border-blue-600 text-blue-600 rounded text-sm font-medium hover:bg-blue-50"
          >
            + Add Sender
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visibility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaigns</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {senders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No senders added yet. Please add one to start sending campaigns.
                  </td>
                </tr>
              ) : (
                senders.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.from_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.from_email}</td>
                    <td className="px-6 py-4">
                      {s.visibility === 'private' ? (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Private</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Public</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.campaign_count || 0}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(s)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingSender(s)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: ZEROBOUNCE EMAIL VERIFICATION */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Email Verification (ZeroBounce)</h2>
            <p className="text-sm text-gray-500">Verify email addresses before sending campaigns to reduce bounces.</p>
          </div>
          {hasZbKey && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-green-700 font-medium">Connected</span>
            </div>
          )}
        </div>

        <div className="max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZeroBounce API Key
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={zbShowKey ? 'text' : 'password'}
                  value={zbKey}
                  onChange={(e) => setZbKey(e.target.value)}
                  placeholder={hasZbKey ? `Stored: ${zbMaskedKey}` : "Enter your ZeroBounce API key"}
                  className="w-full border rounded px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setZbShowKey(!zbShowKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  tabIndex={-1}
                >
                  {zbShowKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                onClick={handleSaveZbKey}
                disabled={zbLoading || !zbKey}
                className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {zbLoading ? 'Validating...' : 'Save Key'}
              </button>
            </div>
          </div>

          {/* Credit Balance */}
          {hasZbKey && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <span className="text-sm text-gray-600">Credit Balance: </span>
                <span className="text-sm font-semibold text-gray-900">
                  {zbCredits !== null ? zbCredits.toLocaleString() : '---'}
                </span>
              </div>
              <button
                onClick={handleCheckCredits}
                disabled={zbCreditsLoading}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
              >
                {zbCreditsLoading ? 'Checking...' : 'Check Credits'}
              </button>
            </div>
          )}

          {zbMessage && (
            <p className={`text-xs ${zbMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {zbMessage.text}
            </p>
          )}
          <p className="text-xs text-gray-500">
            Your API key is validated against ZeroBounce on save. Credits are consumed per email verified.
          </p>
        </div>
      </div>

      {/* SECTION 4: ZOHO CRM */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">CRM Integration (Zoho)</h2>
            <p className="text-sm text-gray-500">Push verified contacts to Zoho CRM as Leads or Contacts.</p>
          </div>
          {hasZoho ? (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-green-700 font-medium">
                Connected{zohoOrgName ? ` (${zohoOrgName})` : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
              <span className="text-sm text-gray-500">Not connected</span>
            </div>
          )}
        </div>

        {hasZoho ? (
          /* Connected state — show summary + disconnect */
          <div className="max-w-xl space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Client ID:</span>
                  <span className="text-sm font-mono text-gray-900">{zohoMaskedClientId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Datacenter:</span>
                  <span className="text-sm font-mono text-gray-900">{zohoDatacenter}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setHasZoho(false); setZohoMessage(null); }}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-100"
              >
                Update Credentials
              </button>
              <button
                onClick={handleRemoveZoho}
                disabled={zohoRemoveLoading}
                className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {zohoRemoveLoading ? 'Removing...' : 'Disconnect'}
              </button>
            </div>

            {zohoMessage && (
              <p className={`text-xs ${zohoMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {zohoMessage.text}
              </p>
            )}
          </div>
        ) : (
          /* Disconnected state — show setup form */
          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type={zohoShowSecrets ? 'text' : 'password'}
                value={zohoClientId}
                onChange={(e) => setZohoClientId(e.target.value)}
                placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
              <input
                type={zohoShowSecrets ? 'text' : 'password'}
                value={zohoClientSecret}
                onChange={(e) => setZohoClientSecret(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Token</label>
              <input
                type={zohoShowSecrets ? 'text' : 'password'}
                value={zohoRefreshToken}
                onChange={(e) => setZohoRefreshToken(e.target.value)}
                placeholder="1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Datacenter</label>
              <select
                value={zohoDatacenter}
                onChange={(e) => setZohoDatacenter(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="com">United States (zoho.com)</option>
                <option value="eu">Europe (zoho.eu)</option>
                <option value="in">India (zoho.in)</option>
                <option value="com.au">Australia (zoho.com.au)</option>
                <option value="jp">Japan (zoho.jp)</option>
                <option value="ca">Canada (zohocloud.ca)</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={zohoShowSecrets}
                  onChange={(e) => setZohoShowSecrets(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Show values
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveZoho}
                disabled={zohoLoading || !zohoClientId || !zohoClientSecret || !zohoRefreshToken}
                className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {zohoLoading ? 'Connecting...' : 'Connect to Zoho'}
              </button>
            </div>

            {zohoMessage && (
              <p className={`text-xs ${zohoMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {zohoMessage.text}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Credentials are validated by connecting to Zoho CRM API. If validation fails, credentials are not stored.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 5: REPLY DETECTION HEALTH */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Reply Detection</h2>
            <p className="text-sm text-gray-500">Monitor inbound reply detection via Gmail forwarding.</p>
          </div>
          {replyHealth && (
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${
                replyHealth.status === 'active' ? 'bg-green-500' : replyHealth.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></span>
              <span className={`text-sm font-medium ${
                replyHealth.status === 'active' ? 'text-green-700' : replyHealth.status === 'warning' ? 'text-yellow-700' : 'text-red-600'
              }`}>
                {replyHealth.status === 'active' ? 'Active' : replyHealth.status === 'warning' ? 'Warning' : 'Not Working'}
              </span>
            </div>
          )}
        </div>

        {replyHealth ? (
          <div className="space-y-4">
            {/* Status warning banners */}
            {replyHealth.status === 'warning' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                No replies detected in the last 7 days. Please verify your Gmail Content Compliance rule is active.
              </div>
            )}
            {replyHealth.status === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                Reply detection may not be working. No replies in the last 30 days. Check Gmail Admin Console settings.
              </div>
            )}

            {/* Config info */}
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Mode</p>
                <p className="text-sm font-medium">{replyHealth.mode}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Forward Address</p>
                <p className="text-sm font-mono font-medium">{replyHealth.forward_address}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Replies (7 days)</p>
                <p className="text-sm font-bold">{replyHealth.replies_7d}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Last Reply</p>
                <p className="text-sm font-medium">
                  {replyHealth.last_reply
                    ? new Date(replyHealth.last_reply).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Never'}
                </p>
              </div>
            </div>

            {/* Gmail filter info */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg max-w-xl">
              <p className="text-xs font-medium text-blue-700 mb-1">Gmail Content Compliance Filter</p>
              <p className="text-xs text-blue-600">
                Header match: <code className="bg-blue-100 px-1 rounded">{replyHealth.gmail_filter}</code>
                {' '}&rarr; Forward to <code className="bg-blue-100 px-1 rounded">{replyHealth.forward_address}</code>
              </p>
            </div>

            {/* Test button */}
            <div className="flex items-center gap-3 max-w-xl">
              <button
                onClick={handleReplyTest}
                disabled={replyTestLoading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {replyTestLoading ? 'Sending...' : 'Send Test Reply'}
              </button>
              {replyHealth.test_reply_received && (
                <span className="text-sm text-green-600 font-medium">Reply detection verified!</span>
              )}
            </div>
            {replyTestMessage && (
              <p className={`text-xs max-w-xl ${
                replyTestMessage.startsWith('Error') ? 'text-red-600'
                : replyTestMessage.includes('working') ? 'text-green-600'
                : 'text-gray-600'
              }`}>
                {replyTestMessage}
              </p>
            )}
            {replyHealth.last_test_at && (
              <p className="text-xs text-gray-500">
                Last test: {new Date(replyHealth.last_test_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {replyHealth.test_reply_received ? ' — Successful' : ''}
              </p>
            )}

            {/* Recent replies */}
            {replyHealth.recent_replies && replyHealth.recent_replies.length > 0 && (
              <div className="max-w-xl">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Replies</h3>
                <div className="space-y-1">
                  {replyHealth.recent_replies.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-gray-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-700 truncate">{r.email}</span>
                        {r.subject && <span className="text-gray-400 truncate hidden sm:inline">&mdash; {r.subject}</span>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-gray-400 truncate max-w-[120px]">{r.campaign_name}</span>
                        <span className="text-gray-400">
                          {new Date(r.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Loading reply detection status...</p>
        )}
      </div>

      {/* CREATE SENDER MODAL */}
      {showSenderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Add New Sender</h3>
            {createError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{createError}</div>}

            <form onSubmit={handleCreateSender} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Name</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded px-3 py-2"
                  value={newSenderName}
                  onChange={e => setNewSenderName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">From Email</label>
                <input
                  type="email"
                  required
                  className="w-full border rounded px-3 py-2"
                  value={newSenderEmail}
                  onChange={e => setNewSenderEmail(e.target.value)}
                  placeholder="e.g. john@company.com"
                />
                <p className="text-xs text-orange-600 mt-1">
                  Make sure this email is verified in your SendGrid account (Sender Authentication).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Visibility</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sender-visibility"
                      value="shared"
                      checked={newSenderVisibility === 'shared'}
                      onChange={() => setNewSenderVisibility('shared')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Public</span>
                    <span className="text-xs text-gray-400">(everyone)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sender-visibility"
                      value="private"
                      checked={newSenderVisibility === 'private'}
                      onChange={() => setNewSenderVisibility('private')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Private</span>
                    <span className="text-xs text-gray-400">(you + managers)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowSenderModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {createLoading ? "Adding..." : "Add Sender"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT SENDER MODAL */}
      {editingSender && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Edit Sender</h3>
            {editError && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{editError}</div>}

            <form onSubmit={handleEditSender} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Email</label>
                <input
                  type="email"
                  disabled
                  className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={editingSender.from_email}
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed (requires SendGrid re-verification).</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">From Name</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded px-3 py-2"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reply-To Email <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={editReplyTo}
                  onChange={e => setEditReplyTo(e.target.value)}
                  placeholder="e.g. replies@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Visibility</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-visibility"
                      value="shared"
                      checked={editVisibility === 'shared'}
                      onChange={() => setEditVisibility('shared')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Public</span>
                    <span className="text-xs text-gray-400">(everyone)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-visibility"
                      value="private"
                      checked={editVisibility === 'private'}
                      onChange={() => setEditVisibility('private')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">Private</span>
                    <span className="text-xs text-gray-400">(you + managers)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditingSender(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SENDER CONFIRM MODAL */}
      {deletingSender && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-2">Delete Sender</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to delete <strong>{deletingSender.from_name}</strong> ({deletingSender.from_email})?
            </p>
            {deletingSender.campaign_count > 0 && (
              <p className="text-sm text-orange-600 bg-orange-50 px-3 py-2 rounded mt-2">
                This sender has been used in {deletingSender.campaign_count} campaign{deletingSender.campaign_count > 1 ? 's' : ''}.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
              <button
                onClick={() => setDeletingSender(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSender}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
