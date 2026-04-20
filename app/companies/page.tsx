"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { getAuthHeaders } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  ShieldCheck,
  X,
  Mail,
  Phone,
  Briefcase,
  Globe,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface Company {
  company_key: string;
  company_name: string;
  industry: string | null;
  contact_count: number;
  verified_count: number;
  country: string | null;
  last_added: string;
}

interface CompanyContact {
  person_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email_status: string | null;
  person_created_at: string;
  company_name: string;
  job_title: string | null;
  industry: string | null;
  country: string | null;
  source_url: string | null;
  affiliation_created_at: string;
}

type SortField = "contact_count" | "company_name" | "industry" | "country" | "verified_count" | "last_added";

export default function CompaniesPage() {
  useAuthGuard();

  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [minContacts, setMinContacts] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortField>("contact_count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Slide-over state
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const ITEMS_PER_PAGE = 25;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      if (search) params.set("search", search);
      if (industry) params.set("industry", industry);
      if (country) params.set("country", country);
      if (minContacts) params.set("min_contacts", minContacts);

      const res = await fetch(`/api/companies?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch companies");

      const data = await res.json();
      setCompanies(data.companies || []);
      setTotal(data.total || 0);
      if (data.industries) setIndustries(data.industries);
    } catch (err) {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [page, search, industry, country, minContacts, sortBy, sortOrder]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const fetchContacts = async (companyName: string) => {
    setSelectedCompany(companyName);
    setContactsLoading(true);
    setContacts([]);

    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(companyName)}/contacts`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch contacts");

      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      toast.error("Failed to load contacts");
    } finally {
      setContactsLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  const emailStatusBadge = (status: string | null) => {
    if (status === "valid") return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Valid</span>;
    if (status === "invalid") return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Invalid</span>;
    if (status === "catch-all") return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">Catch-all</span>;
    return <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Unknown</span>;
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-orange-500" />
            Companies
          </h1>
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} companies across your contact database
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 relative">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Company name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
            <select
              value={industry}
              onChange={(e) => { setIndustry(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
            <input
              type="text"
              placeholder="e.g. Turkey"
              value={country}
              onChange={(e) => { setCountry(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Contacts</label>
            <input
              type="number"
              placeholder="0"
              min="0"
              value={minContacts}
              onChange={(e) => { setMinContacts(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-white">
        {loading ? (
          <div className="p-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded mb-2"></div>
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No companies found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("company_name")}>
                    Company Name <SortIcon field="company_name" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("industry")}>
                    Industry <SortIcon field="industry" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("country")}>
                    Country <SortIcon field="country" />
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort("contact_count")}>
                    Contacts <SortIcon field="contact_count" />
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort("verified_count")}>
                    Verified <SortIcon field="verified_count" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort("last_added")}>
                    Last Added <SortIcon field="last_added" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((company) => (
                  <tr key={company.company_key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => fetchContacts(company.company_name)}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {company.company_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {company.industry || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {company.country || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        <Users className="h-3 w-3" />
                        {company.contact_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {company.verified_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          <ShieldCheck className="h-3 w-3" />
                          {company.verified_count}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(company.last_added).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-700">
              Showing <span className="font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
              <span className="font-medium">{Math.min(page * ITEMS_PER_PAGE, total)}</span>{" "}
              of <span className="font-medium">{total.toLocaleString()}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 py-1 text-sm">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Panel */}
      {selectedCompany && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedCompany(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-xl bg-white shadow-xl flex flex-col h-full animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Slide-over Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-500" />
                  {selectedCompany}
                </h2>
                <p className="text-sm text-gray-500">
                  {contactsLoading ? "Loading..." : `${contacts.length} contacts`}
                </p>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="p-2 rounded hover:bg-gray-200">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No contacts found</p>
                </div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={`${contact.person_id}-${contact.affiliation_created_at}`}
                    className="border rounded-lg p-4 hover:border-orange-200 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/leads/${contact.person_id}`)}
                            className="font-medium text-gray-900 hover:text-orange-600"
                          >
                            {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—"}
                          </button>
                          {emailStatusBadge(contact.email_status)}
                        </div>

                        <div className="mt-1.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Phone className="h-3.5 w-3.5 text-gray-400" />
                              {contact.phone}
                            </div>
                          )}
                          {contact.job_title && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                              {contact.job_title}
                            </div>
                          )}
                          {contact.source_url && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                              <Globe className="h-3.5 w-3.5 text-gray-400" />
                              <a
                                href={contact.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate hover:text-blue-600"
                              >
                                {(() => { try { return new URL(contact.source_url).hostname; } catch { return contact.source_url; } })()}
                                <ExternalLink className="h-3 w-3 inline ml-1" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {contact.country && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {contact.country}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
