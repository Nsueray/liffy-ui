'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, ChevronLeft, Edit, X, Check } from 'lucide-react';
import Link from 'next/link';

const API = '';
function token() { return typeof window !== 'undefined' ? localStorage.getItem('liffy_token') || '' : ''; }
function headers() { return { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }; }

interface Office { id: string; code: string; name: string; default_currency: string | null; }
interface Expo { id: string; name: string; country_code: string; city: string | null; start_date: string | null; end_date: string | null; payment_deadline: string | null; default_currency: string | null; is_active: boolean; }
interface Product { id: string; code: string; name: string; category: string | null; unit_type: string; is_active: boolean; prices?: PPrice[]; }
interface PPrice { id?: string; office_id: string; office_code?: string; office_name?: string; currency: string; unit_price: string; }
interface Rate { currency: string; rate_to_eur: string; updated_at: string; }
interface User { id: string; email: string; first_name: string | null; last_name: string | null; office_id: string | null; }

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

export default function CatalogPage() {
  const [tab, setTab] = useState<'expos' | 'products' | 'rates' | 'offices'>('expos');
  const [offices, setOffices] = useState<Office[]>([]);
  const [expos, setExpos] = useState<Expo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Form states
  const [expoForm, setExpoForm] = useState<Partial<Expo> & { _editing?: boolean }>({});
  const [prodForm, setProdForm] = useState<Partial<Product> & { _editing?: boolean }>({});
  const [priceEditing, setPriceEditing] = useState<string | null>(null); // product id being price-edited
  const [priceValues, setPriceValues] = useState<Record<string, { currency: string; unit_price: string }>>({});
  const [rateForm, setRateForm] = useState({ currency: '', rate_to_eur: '' });
  const [officeAssign, setOfficeAssign] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    const h = { headers: headers() };
    const [o, e, p, r, u] = await Promise.all([
      fetch(`${API}/api/quotes/offices`, h),
      fetch(`${API}/api/quotes/expos?active_only=false`, h),
      fetch(`${API}/api/quotes/products?active_only=false`, h),
      fetch(`${API}/api/quotes/exchange-rates`, h),
      fetch(`${API}/api/users`, h),
    ]);
    if (o.ok) setOffices(await o.json());
    if (e.ok) setExpos(await e.json());
    if (p.ok) setProducts(await p.json());
    if (r.ok) setRates(await r.json());
    if (u.ok) { const d = await u.json(); setUsers(d.users || d); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── EXPOS ──────────────────────────────────────────────────────────────────

  const saveExpo = async () => {
    const f = expoForm;
    if (!f.name?.trim()) { alert('Name required'); return; }
    const body = { name: f.name, country_code: f.country_code || null, city: f.city || null, start_date: f.start_date || null, end_date: f.end_date || null, payment_deadline: f.payment_deadline || null, default_currency: f.default_currency || null, is_active: f.is_active ?? true };
    const method = f.id ? 'PUT' : 'POST';
    const url = f.id ? `${API}/api/quotes/expos/${f.id}` : `${API}/api/quotes/expos`;
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setExpoForm({});
    fetchAll();
  };

  // ─── PRODUCTS ───────────────────────────────────────────────────────────────

  const saveProduct = async () => {
    const f = prodForm;
    if (!f.code?.trim() || !f.name?.trim()) { alert('Code and name required'); return; }
    const body = { code: f.code, name: f.name, category: f.category || null, unit_type: f.unit_type || 'unit', is_active: f.is_active ?? true };
    const method = f.id ? 'PUT' : 'POST';
    const url = f.id ? `${API}/api/quotes/products/${f.id}` : `${API}/api/quotes/products`;
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setProdForm({});
    fetchAll();
  };

  const loadPrices = async (productId: string) => {
    const res = await fetch(`${API}/api/quotes/products/${productId}/prices`, { headers: headers() });
    if (!res.ok) return;
    const prices: PPrice[] = await res.json();
    const vals: Record<string, { currency: string; unit_price: string }> = {};
    for (const p of prices) vals[p.office_id] = { currency: p.currency, unit_price: p.unit_price };
    setPriceValues(vals);
    setPriceEditing(productId);
  };

  const savePrice = async (officeId: string) => {
    if (!priceEditing) return;
    const v = priceValues[officeId];
    if (!v?.currency || !v?.unit_price) return;
    await fetch(`${API}/api/quotes/products/${priceEditing}/prices/${officeId}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ currency: v.currency, unit_price: Number(v.unit_price) }),
    });
    loadPrices(priceEditing);
  };

  // ─── RATES ──────────────────────────────────────────────────────────────────

  const saveRate = async (currency?: string, rateVal?: string) => {
    const cur = currency || rateForm.currency.toUpperCase();
    const rate = rateVal || rateForm.rate_to_eur;
    if (!cur || !rate) { alert('Currency and rate required'); return; }
    const res = await fetch(`${API}/api/quotes/exchange-rates/${cur}`, {
      method: 'PUT', headers: headers(), body: JSON.stringify({ rate_to_eur: Number(rate) }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setRateForm({ currency: '', rate_to_eur: '' });
    fetchAll();
  };

  // ─── OFFICES ────────────────────────────────────────────────────────────────

  const assignOffice = async (userId: string, officeId: string) => {
    await fetch(`${API}/api/quotes/users/${userId}/office`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ office_id: officeId || null }),
    });
    fetchAll();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'expos', label: 'Expos' },
    { key: 'products', label: 'Products & Prices' },
    { key: 'rates', label: 'Exchange Rates' },
    { key: 'offices', label: 'Users & Offices' },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/quotes"><Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4 mr-1" /> Quotes</Button></Link>
        <h2 className="text-2xl font-semibold">Catalog & Reference Data</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* EXPOS TAB */}
      {tab === 'expos' && (
        <div className="space-y-4">
          <Button size="sm" onClick={() => setExpoForm({ _editing: true })}><Plus className="h-4 w-4 mr-1" /> New Expo</Button>

          {expoForm._editing && (
            <Card><CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium">Name *</label><Input value={expoForm.name || ''} onChange={e => setExpoForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Country (2-char)</label><Input value={expoForm.country_code || ''} maxLength={2} onChange={e => setExpoForm(p => ({ ...p, country_code: e.target.value.toUpperCase() }))} /></div>
                <div><label className="text-xs font-medium">City</label><Input value={expoForm.city || ''} onChange={e => setExpoForm(p => ({ ...p, city: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Start Date</label><Input type="date" value={expoForm.start_date?.slice(0, 10) || ''} onChange={e => setExpoForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">End Date</label><Input type="date" value={expoForm.end_date?.slice(0, 10) || ''} onChange={e => setExpoForm(p => ({ ...p, end_date: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Payment Deadline</label><Input type="date" value={expoForm.payment_deadline?.slice(0, 10) || ''} onChange={e => setExpoForm(p => ({ ...p, payment_deadline: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Default Currency</label><Input value={expoForm.default_currency || ''} maxLength={3} onChange={e => setExpoForm(p => ({ ...p, default_currency: e.target.value.toUpperCase() }))} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveExpo}><Save className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" onClick={() => setExpoForm({})}>Cancel</Button>
              </div>
            </CardContent></Card>
          )}

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Country</TableHead><TableHead>City</TableHead>
                <TableHead>Dates</TableHead><TableHead>Payment Deadline</TableHead><TableHead>Currency</TableHead>
                <TableHead>Active</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {expos.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.country_code || '—'}</TableCell>
                    <TableCell>{e.city || '—'}</TableCell>
                    <TableCell className="text-sm">{fmtDate(e.start_date)} – {fmtDate(e.end_date)}</TableCell>
                    <TableCell>{fmtDate(e.payment_deadline)}</TableCell>
                    <TableCell>{e.default_currency || '—'}</TableCell>
                    <TableCell><Badge className={e.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>{e.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setExpoForm({ ...e, _editing: true })}><Edit className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      )}

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <div className="space-y-4">
          <Button size="sm" onClick={() => setProdForm({ _editing: true, unit_type: 'unit' })}><Plus className="h-4 w-4 mr-1" /> New Product</Button>

          {prodForm._editing && (
            <Card><CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div><label className="text-xs font-medium">Code *</label><Input value={prodForm.code || ''} onChange={e => setProdForm(p => ({ ...p, code: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Name *</label><Input value={prodForm.name || ''} onChange={e => setProdForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Category</label><Input value={prodForm.category || ''} onChange={e => setProdForm(p => ({ ...p, category: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Unit Type *</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={prodForm.unit_type || 'unit'} onChange={e => setProdForm(p => ({ ...p, unit_type: e.target.value }))}>
                    <option value="m2">m²</option><option value="unit">unit</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveProduct}><Save className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" onClick={() => setProdForm({})}>Cancel</Button>
              </div>
            </CardContent></Card>
          )}

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
                <TableHead>Type</TableHead><TableHead>Active</TableHead><TableHead>Prices</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{p.unit_type}</Badge></TableCell>
                    <TableCell><Badge className={p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => loadPrices(p.id)}>
                        {priceEditing === p.id ? 'Close' : 'Edit Prices'}
                      </Button>
                    </TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setProdForm({ ...p, _editing: true })}><Edit className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>

          {/* Price editor */}
          {priceEditing && (
            <Card><CardContent className="p-4">
              <h4 className="font-medium mb-3">Prices for: {products.find(p => p.id === priceEditing)?.name}</h4>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Office</TableHead><TableHead>Currency</TableHead><TableHead>Unit Price</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {offices.map(off => {
                    const v = priceValues[off.id] || { currency: off.default_currency || '', unit_price: '' };
                    return (
                      <TableRow key={off.id}>
                        <TableCell className="font-medium">{off.code} — {off.name}</TableCell>
                        <TableCell><Input className="w-20" value={v.currency} onChange={e => setPriceValues(p => ({ ...p, [off.id]: { ...v, currency: e.target.value.toUpperCase() } }))} /></TableCell>
                        <TableCell><Input className="w-32" type="number" min={0} step={0.01} value={v.unit_price} onChange={e => setPriceValues(p => ({ ...p, [off.id]: { ...v, unit_price: e.target.value } }))} /></TableCell>
                        <TableCell><Button size="sm" onClick={() => savePrice(off.id)} disabled={!v.currency || !v.unit_price}><Check className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* RATES TAB */}
      {tab === 'rates' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div><label className="text-xs font-medium">Currency</label><Input className="w-20" value={rateForm.currency} maxLength={3} onChange={e => setRateForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} placeholder="NGN" /></div>
            <div><label className="text-xs font-medium">Rate to EUR</label><Input className="w-40" value={rateForm.rate_to_eur} onChange={e => setRateForm(p => ({ ...p, rate_to_eur: e.target.value }))} placeholder="0.00058" /></div>
            <Button size="sm" onClick={() => saveRate()} disabled={!rateForm.currency || !rateForm.rate_to_eur}><Plus className="h-4 w-4 mr-1" /> Add/Update</Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Currency</TableHead><TableHead>Rate to EUR</TableHead><TableHead>Updated</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rates.map(r => (
                  <TableRow key={r.currency}>
                    <TableCell className="font-mono font-medium">{r.currency}</TableCell>
                    <TableCell className="font-mono">{r.rate_to_eur}</TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtDate(r.updated_at)}</TableCell>
                    <TableCell>
                      {r.currency !== 'EUR' && (
                        <Button size="sm" variant="ghost" onClick={() => {
                          const newRate = prompt(`New rate for ${r.currency} (current: ${r.rate_to_eur})`);
                          if (newRate) saveRate(r.currency, newRate);
                        }}><Edit className="h-3 w-3" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      )}

      {/* OFFICES TAB */}
      {tab === 'offices' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Assign offices to users. This determines default currency and AF number prefix for quotes.</p>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Current Office</TableHead><TableHead>Assign Office</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>{offices.find(o => o.id === u.office_id)?.code || <span className="text-gray-400">None</span>}</TableCell>
                    <TableCell>
                      <select className="border rounded px-2 py-1 text-sm" value={officeAssign[u.id] ?? u.office_id ?? ''}
                        onChange={e => {
                          setOfficeAssign(p => ({ ...p, [u.id]: e.target.value }));
                          assignOffice(u.id, e.target.value);
                        }}>
                        <option value="">None</option>
                        {offices.map(o => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>

          <h3 className="font-medium mt-6">Offices (seed data)</h3>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Default Currency</TableHead></TableRow></TableHeader>
              <TableBody>
                {offices.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-medium">{o.code}</TableCell>
                    <TableCell>{o.name}</TableCell>
                    <TableCell>{o.default_currency || <span className="text-gray-400">Not set</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}
