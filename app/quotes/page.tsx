'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Send, CheckCircle, XCircle, Trash2, Edit, Eye, X, ChevronLeft, Settings } from 'lucide-react';
import Link from 'next/link';

const API_BASE = '';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('liffy_token') || '';
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}
function getCurrentUserRole(): string {
  try {
    const u = JSON.parse(localStorage.getItem('liffy_user') || '{}');
    return u.role || '';
  } catch { return ''; }
}
function isAdmin() {
  const r = getCurrentUserRole();
  return r === 'owner' || r === 'admin';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quote {
  id: string;
  af_number: string;
  af_sequence: string;
  subject: string;
  status: string;
  currency: string;
  exchange_rate_to_eur: string;
  valid_until: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  signed_scan_url: string | null;
  notes: string | null;
  is_expired: boolean;
  office_id: string;
  expo_id: string;
  company_name: string;
  person_id: string | null;
  sales_owner_user_id: string;
  created_by_user_id: string;
  office_code: string;
  expo_name?: string;
  person_first_name?: string;
  person_last_name?: string;
  person_email?: string;
  owner_first_name?: string;
  owner_last_name?: string;
  line_items: LineItem[];
  totals: Totals;
  expo?: { name: string; payment_deadline: string };
  person?: { first_name: string; last_name: string; email: string };
  sales_owner?: { first_name: string; last_name: string; email: string };
}

interface LineItem {
  id: string;
  quote_id: string;
  product_id: string | null;
  description: string;
  unit_type: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_percent: string;
  sort_order: number;
  line_total: number;
}

interface Totals {
  subtotal: number;
  total_discount: number;
  total_tax: number;
  grand_total: number;
  grand_total_eur: number;
  total_m2: number;
}

interface Office { id: string; code: string; name: string; default_currency: string | null; }
interface Expo { id: string; name: string; country_code: string; payment_deadline: string | null; default_currency: string | null; }
interface PersonOption { id: string; first_name: string; last_name: string; email: string; company_name?: string; }
interface Product { id: string; code: string; name: string; category: string | null; unit_type: string; prices?: ProductPrice[]; }
interface ProductPrice { office_id: string; office_code: string; currency: string; unit_price: string; }
interface ExchangeRate { currency: string; rate_to_eur: string; updated_at: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMoney(n: number, currency?: string) {
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${s} ${currency}` : s;
}
function statusColor(s: string, expired?: boolean) {
  if (expired) return 'bg-red-100 text-red-800';
  switch (s) {
    case 'draft': return 'bg-gray-100 text-gray-700';
    case 'sent': return 'bg-blue-100 text-blue-700';
    case 'signed': return 'bg-green-100 text-green-700';
    case 'declined': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}
function statusLabel(s: string, expired?: boolean) {
  if (expired) return 'Expired';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function calcLineTotal(li: { quantity: number; unit_price: number; discount_percent: number; tax_percent: number }) {
  const sub = li.quantity * li.unit_price;
  const afterDisc = sub * (1 - li.discount_percent / 100);
  return afterDisc * (1 + li.tax_percent / 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  // View state
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // List state
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Reference data
  const [offices, setOffices] = useState<Office[]>([]);
  const [expos, setExpos] = useState<Expo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);

  // Company autocomplete
  const [companyQuery, setCompanyQuery] = useState('');
  const [companySuggestions, setCompanySuggestions] = useState<{ company_name: string; contact_count: number }[]>([]);
  const [companyOpen, setCompanyOpen] = useState(false);

  // Person autocomplete
  const [personQuery, setPersonQuery] = useState('');
  const [personSuggestions, setPersonSuggestions] = useState<PersonOption[]>([]);
  const [personOpen, setPersonOpen] = useState(false);
  const [selectedPersonLabel, setSelectedPersonLabel] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    expo_id: '', company_name: '', person_id: '', office_id: '', currency: '',
    exchange_rate_to_eur: '', valid_until: '', notes: '', subject: '',
  });
  const [formLines, setFormLines] = useState<{
    product_id: string; description: string; unit_type: string;
    quantity: number; unit_price: number; discount_percent: number; tax_percent: number;
  }[]>([]);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [signDialog, setSignDialog] = useState(false);
  const [signUrl, setSignUrl] = useState('');
  const [signDate, setSignDate] = useState('');

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/api/quotes?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const data = await res.json();
      setQuotes(data.quotes || []);
      setTotal(data.total || 0);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [page, search, statusFilter]);

  const fetchRefData = useCallback(async () => {
    const h = { headers: authHeaders() };
    const [offRes, exRes, prodRes, rateRes] = await Promise.all([
      fetch(`${API_BASE}/api/quotes/offices`, h),
      fetch(`${API_BASE}/api/quotes/expos`, h),
      fetch(`${API_BASE}/api/quotes/products`, h),
      fetch(`${API_BASE}/api/quotes/exchange-rates`, h),
    ]);
    if (offRes.ok) setOffices(await offRes.json());
    if (exRes.ok) setExpos(await exRes.json());
    if (prodRes.ok) setProducts(await prodRes.json());
    if (rateRes.ok) setRates(await rateRes.json());
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);
  useEffect(() => { fetchRefData(); }, [fetchRefData]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const openDetail = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/quotes/${id}`, { headers: authHeaders() });
    if (!res.ok) { alert('Failed to load quote'); return; }
    setSelectedQuote(await res.json());
    setView('detail');
  };

  const openCreate = () => {
    setFormMode('create');
    // Default office from user
    const userOfficeId = offices.length === 1 ? offices[0].id : '';
    setFormData({ expo_id: '', company_name: '', person_id: '', office_id: userOfficeId, currency: '', exchange_rate_to_eur: '', valid_until: '', notes: '', subject: '' });
    setCompanyQuery(''); setCompanySuggestions([]); setCompanyOpen(false);
    setPersonQuery(''); setPersonSuggestions([]); setPersonOpen(false); setSelectedPersonLabel('');
    setFormLines([{ product_id: '', description: '', unit_type: 'unit', quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 0 }]);
    setView('form');
  };

  const openEdit = () => {
    if (!selectedQuote) return;
    setFormMode('edit');
    setCompanyQuery(selectedQuote.company_name || '');
    setCompanySuggestions([]); setCompanyOpen(false);
    const pLabel = selectedQuote.person ? `${selectedQuote.person.first_name || ''} ${selectedQuote.person.last_name || ''}`.trim() || selectedQuote.person.email : '';
    setPersonQuery(pLabel); setSelectedPersonLabel(pLabel); setPersonSuggestions([]); setPersonOpen(false);
    setFormData({
      expo_id: selectedQuote.expo_id, company_name: selectedQuote.company_name || '',
      person_id: selectedQuote.person_id || '', office_id: selectedQuote.office_id,
      currency: selectedQuote.currency, exchange_rate_to_eur: selectedQuote.exchange_rate_to_eur,
      valid_until: selectedQuote.valid_until?.slice(0, 10) || '', notes: selectedQuote.notes || '',
      subject: selectedQuote.subject,
    });
    setFormLines(selectedQuote.line_items.map(li => ({
      product_id: li.product_id || '', description: li.description, unit_type: li.unit_type,
      quantity: Number(li.quantity), unit_price: Number(li.unit_price),
      discount_percent: Number(li.discount_percent), tax_percent: Number(li.tax_percent),
    })));
    setView('form');
  };

  // Office/currency/rate resolution on form field changes
  const onOfficeChange = (officeId: string) => {
    const off = offices.find(o => o.id === officeId);
    const cur = off?.default_currency || formData.currency;
    const rate = rates.find(r => r.currency === cur);
    setFormData(p => ({ ...p, office_id: officeId, currency: cur, exchange_rate_to_eur: rate?.rate_to_eur || '' }));
  };
  const onCurrencyChange = (cur: string) => {
    const rate = rates.find(r => r.currency === cur);
    setFormData(p => ({ ...p, currency: cur, exchange_rate_to_eur: rate?.rate_to_eur || p.exchange_rate_to_eur }));
  };
  const onExpoChange = (expoId: string) => {
    const ex = expos.find(e => e.id === expoId);
    setFormData(p => ({ ...p, expo_id: expoId, valid_until: ex?.payment_deadline?.slice(0, 10) || p.valid_until }));
  };

  // Product selection fills snapshot
  const onProductSelect = (idx: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const price = prod.prices?.find(pp => pp.office_id === formData.office_id);
    setFormLines(prev => prev.map((li, i) => i === idx ? {
      ...li, product_id: productId, description: prod.name, unit_type: prod.unit_type,
      unit_price: price ? Number(price.unit_price) : li.unit_price,
    } : li));
  };

  // Company autocomplete search
  const searchCompanies = useCallback(async (q: string) => {
    if (q.length < 2) { setCompanySuggestions([]); return; }
    try {
      const res = await fetch(`${API_BASE}/api/companies?search=${encodeURIComponent(q)}&limit=20`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setCompanySuggestions((d.companies || d).map((c: { company_name: string; contact_count: number }) => ({
          company_name: c.company_name, contact_count: c.contact_count,
        })));
      }
    } catch { /* ignore */ }
  }, []);

  // Person autocomplete search
  const searchPersons = useCallback(async (q: string) => {
    if (q.length < 2) { setPersonSuggestions([]); return; }
    try {
      const params = new URLSearchParams({ search: q, limit: '20' });
      if (formData.company_name) params.set('company', formData.company_name);
      const res = await fetch(`${API_BASE}/api/persons?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setPersonSuggestions((d.persons || d).map((p: PersonOption) => ({
          id: p.id, first_name: p.first_name, last_name: p.last_name,
          email: p.email, company_name: p.company_name,
        })));
      }
    } catch { /* ignore */ }
  }, [formData.company_name]);

  // Debounced search effects
  useEffect(() => {
    if (!companyOpen) return;
    const t = setTimeout(() => searchCompanies(companyQuery), 300);
    return () => clearTimeout(t);
  }, [companyQuery, companyOpen, searchCompanies]);

  useEffect(() => {
    if (!personOpen) return;
    const t = setTimeout(() => searchPersons(personQuery), 300);
    return () => clearTimeout(t);
  }, [personQuery, personOpen, searchPersons]);

  const addLine = () => setFormLines(p => [...p, { product_id: '', description: '', unit_type: 'unit', quantity: 1, unit_price: 0, discount_percent: 0, tax_percent: 0 }]);
  const removeLine = (idx: number) => setFormLines(p => p.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: string, value: string | number) => {
    setFormLines(p => p.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  // Computed totals for form
  const formTotals = (() => {
    let subtotal = 0, discount = 0, tax = 0, m2 = 0;
    for (const li of formLines) {
      const sub = li.quantity * li.unit_price;
      const d = sub * li.discount_percent / 100;
      const t = (sub - d) * li.tax_percent / 100;
      subtotal += sub; discount += d; tax += t;
      if (li.unit_type === 'm2') m2 += li.quantity;
    }
    const grand = subtotal - discount + tax;
    const rate = Number(formData.exchange_rate_to_eur) || 0;
    return { subtotal, discount, tax, grand, grandEur: grand * rate, m2 };
  })();

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      if (formMode === 'create') {
        const body = {
          ...formData, company_name: formData.company_name.trim(), person_id: formData.person_id || undefined,
          exchange_rate_to_eur: Number(formData.exchange_rate_to_eur) || undefined,
          line_items: formLines.filter(li => li.description),
        };
        const res = await fetch(`${API_BASE}/api/quotes`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Failed'); setSaving(false); return; }
        const created = await res.json();
        setSelectedQuote(created);
        setView('detail');
        fetchQuotes();
      } else if (selectedQuote) {
        // Update quote header
        const res = await fetch(`${API_BASE}/api/quotes/${selectedQuote.id}`, {
          method: 'PUT', headers: authHeaders(),
          body: JSON.stringify({ subject: formData.subject, notes: formData.notes, valid_until: formData.valid_until || null, person_id: formData.person_id || null }),
        });
        if (!res.ok) { const e = await res.json(); alert(e.error || 'Failed'); setSaving(false); return; }

        // Delete existing lines and re-create (simplest approach for draft editing)
        for (const li of selectedQuote.line_items) {
          await fetch(`${API_BASE}/api/quotes/${selectedQuote.id}/items/${li.id}`, { method: 'DELETE', headers: authHeaders() });
        }
        for (const li of formLines.filter(l => l.description)) {
          await fetch(`${API_BASE}/api/quotes/${selectedQuote.id}/items`, {
            method: 'POST', headers: authHeaders(), body: JSON.stringify(li),
          });
        }

        // Reload detail
        await openDetail(selectedQuote.id);
        fetchQuotes();
      }
    } catch (err) { alert('Save failed'); console.error(err); }
    setSaving(false);
  };

  // Status transitions
  const handleSend = async () => {
    if (!selectedQuote) return;
    if (!confirm('Mark this quote as Sent? Subject and line items will be locked.')) return;
    const res = await fetch(`${API_BASE}/api/quotes/${selectedQuote.id}/send`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    await openDetail(selectedQuote.id); fetchQuotes();
  };

  const handleDecline = async () => {
    if (!selectedQuote) return;
    if (!confirm('Mark this quote as Declined?')) return;
    const res = await fetch(`${API_BASE}/api/quotes/${selectedQuote.id}/decline`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    await openDetail(selectedQuote.id); fetchQuotes();
  };

  const handleSign = async () => {
    if (!signUrl.trim() || !signDate) { alert('Scan URL and signing date are required'); return; }
    const res = await fetch(`${API_BASE}/api/quotes/${selectedQuote!.id}/sign`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ signed_scan_url: signUrl, signed_at: signDate }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setSignDialog(false); setSignUrl(''); setSignDate('');
    await openDetail(selectedQuote!.id); fetchQuotes();
  };

  const handleDelete = async () => {
    if (!deleteReason.trim()) { alert('Reason is required'); return; }
    const res = await fetch(`${API_BASE}/api/quotes/${selectedQuote!.id}`, {
      method: 'DELETE', headers: authHeaders(),
      body: JSON.stringify({ reason: deleteReason }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setDeleteDialog(false); setDeleteReason('');
    setView('list'); fetchQuotes();
  };

  // ─── Renders ────────────────────────────────────────────────────────────────

  // LIST VIEW
  if (view === 'list') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Quotes</h2>
        <div className="flex gap-2">
          {isAdmin() && (
            <Link href="/quotes/catalog">
              <Button variant="outline"><Settings className="h-4 w-4 mr-2" /> Products & Pricing</Button>
            </Link>
          )}
          <Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" /> New Quote
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search AF number, subject, company..." className="pl-10"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="border rounded-md px-3 py-2 text-sm" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="signed">Signed</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>AF Number</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Expo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">EUR</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
              ) : quotes.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">No quotes found</TableCell></TableRow>
              ) : quotes.map(q => (
                <TableRow key={q.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(q.id)}>
                  <TableCell className="font-mono font-medium text-sm">{q.af_number}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{q.subject}</TableCell>
                  <TableCell>{q.company_name || '—'}</TableCell>
                  <TableCell>{q.expo_name || '—'}</TableCell>
                  <TableCell>
                    <Badge className={statusColor(q.status, q.is_expired)}>
                      {statusLabel(q.status, q.is_expired)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(q.totals.grand_total, q.currency)}</TableCell>
                  <TableCell className="text-right font-mono text-gray-500">{fmtMoney(q.totals.grand_total_eur, 'EUR')}</TableCell>
                  <TableCell>{fmtDate(q.valid_until)}</TableCell>
                  <TableCell className="text-sm">{[q.owner_first_name, q.owner_last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );

  // DETAIL VIEW
  if (view === 'detail' && selectedQuote) {
    const q = selectedQuote;
    const isDraft = q.status === 'draft';
    const isSent = q.status === 'sent';
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView('list')}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
          <h2 className="text-2xl font-semibold font-mono">{q.af_number}</h2>
          <Badge className={statusColor(q.status, q.is_expired)}>{statusLabel(q.status, q.is_expired)}</Badge>
          <div className="flex-1" />
          {/* Actions */}
          {isDraft && (
            <>
              <Button size="sm" variant="outline" onClick={openEdit}><Edit className="h-4 w-4 mr-1" /> Edit</Button>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSend}><Send className="h-4 w-4 mr-1" /> Send</Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
            </>
          )}
          {isSent && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setSignDialog(true)}><CheckCircle className="h-4 w-4 mr-1" /> Sign</Button>
              <Button size="sm" variant="destructive" onClick={handleDecline}><XCircle className="h-4 w-4 mr-1" /> Decline</Button>
            </>
          )}
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Subject</div><div className="font-medium mt-1">{q.subject}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Company</div><div className="font-medium mt-1">{q.company_name || '—'}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Expo</div><div className="font-medium mt-1">{q.expo?.name || q.expo_name || '—'}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Contact</div><div className="font-medium mt-1">{q.person ? `${q.person.first_name || ''} ${q.person.last_name || ''}`.trim() || q.person.email : '—'}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Office</div><div className="font-medium mt-1">{q.office_code}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Currency / Rate</div><div className="font-medium mt-1">{q.currency} (1 {q.currency} = {Number(q.exchange_rate_to_eur).toFixed(6)} EUR)</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Valid Until</div><div className={`font-medium mt-1 ${q.is_expired ? 'text-red-600' : ''}`}>{fmtDate(q.valid_until)}{q.is_expired ? ' (Expired)' : ''}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Owner</div><div className="font-medium mt-1">{q.sales_owner ? `${q.sales_owner.first_name || ''} ${q.sales_owner.last_name || ''}`.trim() : '—'}</div></CardContent></Card>
          {q.signed_scan_url && (
            <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Signed Scan</div><a href={q.signed_scan_url} target="_blank" rel="noreferrer" className="text-blue-600 underline mt-1 block truncate">{q.signed_scan_url}</a></CardContent></Card>
          )}
          {q.notes && (
            <Card className="col-span-2"><CardContent className="p-4"><div className="text-xs text-gray-500">Notes</div><div className="mt-1 whitespace-pre-wrap">{q.notes}</div></CardContent></Card>
          )}
        </div>

        {/* Line items */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Disc%</TableHead>
                  <TableHead className="text-right">Tax%</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.line_items.map((li, i) => (
                  <TableRow key={li.id}>
                    <TableCell className="text-gray-500">{i + 1}</TableCell>
                    <TableCell>{li.description}</TableCell>
                    <TableCell><Badge variant="outline">{li.unit_type}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{li.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(Number(li.unit_price))}</TableCell>
                    <TableCell className="text-right">{li.discount_percent}%</TableCell>
                    <TableCell className="text-right">{li.tax_percent}%</TableCell>
                    <TableCell className="text-right font-mono font-medium">{fmtMoney(li.line_total, q.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-mono">{fmtMoney(q.totals.subtotal, q.currency)}</span></div>
            {q.totals.total_discount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="font-mono text-red-600">-{fmtMoney(q.totals.total_discount, q.currency)}</span></div>}
            {q.totals.total_tax > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-mono">+{fmtMoney(q.totals.total_tax, q.currency)}</span></div>}
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="font-mono">{fmtMoney(q.totals.grand_total, q.currency)}</span></div>
            {q.currency !== 'EUR' && <div className="flex justify-between text-gray-500"><span>EUR Equivalent</span><span className="font-mono">{fmtMoney(q.totals.grand_total_eur, 'EUR')}</span></div>}
            {q.totals.total_m2 > 0 && <div className="flex justify-between text-gray-500"><span>Total m²</span><span className="font-mono">{q.totals.total_m2} SQM</span></div>}
          </div>
        </div>

        {/* Delete dialog */}
        {deleteDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-96">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Delete Quote {q.af_number}?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone. Please provide a reason.</p>
                <Input placeholder="Reason for deletion..." value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setDeleteDialog(false); setDeleteReason(''); }}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={!deleteReason.trim()}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sign dialog */}
        {signDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-96">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Sign Quote {q.af_number}</h3>
                <p className="text-sm text-gray-500">This will mark the quote as signed (terminal state).</p>
                <div>
                  <label className="text-sm font-medium">Signed Scan URL *</label>
                  <Input placeholder="https://drive.google.com/..." value={signUrl} onChange={e => setSignUrl(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Signing Date *</label>
                  <Input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setSignDialog(false); setSignUrl(''); setSignDate(''); }}>Cancel</Button>
                  <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSign} disabled={!signUrl.trim() || !signDate}>Sign</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // FORM VIEW (Create / Edit)
  if (view === 'form') {
    const isDraftEdit = formMode === 'edit';
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => selectedQuote ? openDetail(selectedQuote.id) : setView('list')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-semibold">{formMode === 'create' ? 'New Quote' : `Edit ${selectedQuote?.af_number}`}</h2>
        </div>

        {/* Header fields */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Expo *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={formData.expo_id}
                  onChange={e => onExpoChange(e.target.value)} disabled={isDraftEdit}>
                  <option value="">Select expo...</option>
                  {expos.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="relative">
                <label className="text-sm font-medium">Company *</label>
                <Input className="mt-1" placeholder="Type 2+ characters to search..." disabled={isDraftEdit}
                  value={companyQuery}
                  onChange={e => { setCompanyQuery(e.target.value); setFormData(p => ({ ...p, company_name: e.target.value })); setCompanyOpen(true); }}
                  onFocus={() => companyQuery.length >= 2 && setCompanyOpen(true)}
                  onBlur={() => setTimeout(() => setCompanyOpen(false), 200)} />
                {companyOpen && companySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                    {companySuggestions.map((c, i) => (
                      <div key={i} className="px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer flex justify-between"
                        onMouseDown={() => {
                          setFormData(p => ({ ...p, company_name: c.company_name }));
                          setCompanyQuery(c.company_name);
                          setCompanyOpen(false);
                        }}>
                        <span>{c.company_name}</span>
                        <span className="text-gray-400 text-xs">{c.contact_count} contacts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Office *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={formData.office_id}
                  onChange={e => onOfficeChange(e.target.value)} disabled={isDraftEdit}>
                  <option value="">Select office...</option>
                  {offices.map(o => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Currency *</label>
                <div className="flex gap-2 mt-1">
                  <Input value={formData.currency} onChange={e => onCurrencyChange(e.target.value.toUpperCase())}
                    maxLength={3} className="w-24" disabled={isDraftEdit} placeholder="EUR" />
                  <div className="flex items-center text-sm text-gray-500 flex-1">
                    <span className="mr-2">Rate:</span>
                    <Input value={formData.exchange_rate_to_eur}
                      onChange={e => setFormData(p => ({ ...p, exchange_rate_to_eur: e.target.value }))}
                      className="w-32" disabled={isDraftEdit} />
                    {formData.currency && formData.exchange_rate_to_eur && (
                      <span className="ml-2 text-xs">1 {formData.currency} = {Number(formData.exchange_rate_to_eur).toFixed(6)} EUR</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Valid Until</label>
                <Input type="date" className="mt-1" value={formData.valid_until}
                  onChange={e => setFormData(p => ({ ...p, valid_until: e.target.value }))} />
              </div>
              <div className="relative">
                <label className="text-sm font-medium">Contact Person</label>
                <Input className="mt-1" placeholder="Search by name or email..."
                  value={personQuery}
                  onChange={e => { setPersonQuery(e.target.value); setPersonOpen(true); if (!e.target.value) { setFormData(p => ({ ...p, person_id: '' })); setSelectedPersonLabel(''); } }}
                  onFocus={() => personQuery.length >= 2 && setPersonOpen(true)}
                  onBlur={() => setTimeout(() => setPersonOpen(false), 200)} />
                {formData.person_id && selectedPersonLabel && (
                  <button type="button" className="absolute right-2 top-8 text-gray-400 hover:text-gray-600"
                    onClick={() => { setFormData(p => ({ ...p, person_id: '' })); setPersonQuery(''); setSelectedPersonLabel(''); }}>
                    <X className="h-4 w-4" />
                  </button>
                )}
                {personOpen && personSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                    {personSuggestions.map(p => (
                      <div key={p.id} className="px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer"
                        onMouseDown={() => {
                          const label = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
                          setFormData(prev => ({ ...prev, person_id: p.id }));
                          setPersonQuery(label);
                          setSelectedPersonLabel(label);
                          setPersonOpen(false);
                        }}>
                        <div className="font-medium">{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-gray-400">{p.email}{p.company_name ? ` · ${p.company_name}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input className="mt-1" value={formData.subject} placeholder="Auto-generated on save"
                  onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm mt-1 h-20" value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line items */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Line Items</h3>
              <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-20 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">Unit Price</TableHead>
                  <TableHead className="w-20 text-right">Disc%</TableHead>
                  <TableHead className="w-20 text-right">Tax%</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formLines.map((li, i) => {
                  const lt = calcLineTotal(li);
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <select className="w-full border rounded px-2 py-1 text-sm" value={li.product_id}
                          onChange={e => onProductSelect(i, e.target.value)}>
                          <option value="">Custom</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                        </select>
                      </TableCell>
                      <TableCell><Input value={li.description} onChange={e => updateLine(i, 'description', e.target.value)} className="text-sm" /></TableCell>
                      <TableCell>
                        <select className="border rounded px-2 py-1 text-sm w-full" value={li.unit_type} onChange={e => updateLine(i, 'unit_type', e.target.value)}>
                          <option value="m2">m²</option>
                          <option value="unit">unit</option>
                        </select>
                      </TableCell>
                      <TableCell><Input type="number" min={0} value={li.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} className="text-right text-sm" /></TableCell>
                      <TableCell><Input type="number" min={0} step={0.01} value={li.unit_price} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} className="text-right text-sm" /></TableCell>
                      <TableCell><Input type="number" min={0} max={100} value={li.discount_percent} onChange={e => updateLine(i, 'discount_percent', Number(e.target.value))} className="text-right text-sm" /></TableCell>
                      <TableCell><Input type="number" min={0} value={li.tax_percent} onChange={e => updateLine(i, 'tax_percent', Number(e.target.value))} className="text-right text-sm" /></TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtMoney(lt)}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => removeLine(i)}><X className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="flex justify-end mt-4">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-mono">{fmtMoney(formTotals.subtotal)}</span></div>
                {formTotals.discount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="font-mono text-red-600">-{fmtMoney(formTotals.discount)}</span></div>}
                {formTotals.tax > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-mono">+{fmtMoney(formTotals.tax)}</span></div>}
                <div className="flex justify-between border-t pt-1 font-semibold"><span>Grand Total</span><span className="font-mono">{fmtMoney(formTotals.grand)}{formData.currency ? ` ${formData.currency}` : ''}</span></div>
                {formData.exchange_rate_to_eur && formData.currency !== 'EUR' && (
                  <div className="flex justify-between text-gray-500"><span>EUR Equivalent</span><span className="font-mono">{fmtMoney(formTotals.grandEur)} EUR</span></div>
                )}
                {formTotals.m2 > 0 && <div className="flex justify-between text-gray-500"><span>Total m²</span><span>{formTotals.m2} SQM</span></div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => selectedQuote ? openDetail(selectedQuote.id) : setView('list')}>Cancel</Button>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleSave} disabled={saving || !formData.expo_id || !formData.company_name.trim()}>
            {saving ? 'Saving...' : formMode === 'create' ? 'Create Quote' : 'Save Changes'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
