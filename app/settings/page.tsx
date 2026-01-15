'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';

interface Sender {
  id: string;
  label: string;
  from_name: string;
  from_email: string;
  is_active: boolean;
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
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";
  const getToken = () => localStorage.getItem('liffy_token');

  // --- FETCH DATA ---
  const fetchSettings = useCallback(async () => {
    const token = getToken();
    if(!token) return;

    try {
      // 1. Get API Key Status
      const settingsRes = await fetch(`${apiBase}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(settingsRes.ok) {
        const data = await settingsRes.json();
        setHasKey(data.settings.has_api_key);
        setMaskedKey(data.settings.masked_api_key);
      }

      // 2. Get Senders (Existing Route)
      const sendersRes = await fetch(`${apiBase}/api/senders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if(sendersRes.ok) {
        const data = await sendersRes.json();
        setSenders(data.items || []); // senders.js returns { items: [] }
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // --- HANDLERS: API KEY ---
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
      // Using existing POST /api/senders from senders.js
      const res = await fetch(`${apiBase}/api/senders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          from_name: newSenderName,
          from_email: newSenderEmail,
          label: `${newSenderName} (${newSenderEmail})`, // Auto-generate label
          is_default: senders.length === 0 // First one is default
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add sender");

      setSenders([data.sender, ...senders]);
      setShowSenderModal(false);
      setNewSenderName('');
      setNewSenderEmail('');
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your email infrastructure and identities.</p>
      </div>

      {/* SECTION 1: API KEY */}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {senders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No senders added yet. Please add one to start sending campaigns.
                  </td>
                </tr>
              ) : (
                senders.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.from_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.from_email}</td>
                    <td className="px-6 py-4">
                      {s.is_active ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Active</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
