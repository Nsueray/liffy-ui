"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Mail,
  Eye,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  FileText,
  Phone,
  CheckCircle,
  RefreshCw,
  Send,
  Building,
  Activity,
  Search,
  ExternalLink,
  Loader2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.liffy.app";

interface Person {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  verification_status: string;
  affiliations?: Array<{
    company_name: string | null;
    position: string | null;
    country_code: string | null;
    city: string | null;
    website: string | null;
    phone: string | null;
  }>;
}

interface TimelineEvent {
  timestamp: string;
  activity_type: string;
  channel: string;
  campaign_name: string | null;
  link_clicked: string | null;
  detail: string | null;
  user_name: string | null;
  email: string | null;
}

interface ContextCard {
  type: string;
  icon: string;
  text: string;
}

interface ContactDrawerProps {
  personId: string;
  actionId: string | null;
  onClose: () => void;
  onResolve?: (actionId: string, status: string) => void;
}

const TIMELINE_ICONS: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  sent: { icon: Send, color: "text-blue-500", label: "Email sent" },
  open: { icon: Eye, color: "text-yellow-600", label: "Opened" },
  click: { icon: MousePointerClick, color: "text-orange-500", label: "Clicked" },
  reply: { icon: MessageSquare, color: "text-red-500", label: "Reply received" },
  bounce: { icon: AlertTriangle, color: "text-red-600", label: "Bounced" },
  note_added: { icon: FileText, color: "text-gray-500", label: "Note added" },
  call: { icon: Phone, color: "text-green-600", label: "Call logged" },
  task: { icon: CheckCircle, color: "text-blue-500", label: "Task" },
  status_change: { icon: RefreshCw, color: "text-purple-500", label: "Status changed" },
  zoho_push: { icon: RefreshCw, color: "text-green-500", label: "Pushed to Zoho CRM" },
};

const CONTEXT_ICONS: Record<string, typeof Building> = {
  building: Building,
  activity: Activity,
  mail: Mail,
  search: Search,
};

const HIDDEN_EVENTS = new Set(["delivered", "deferred", "dropped"]);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (days < 7) {
    return d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ContactDrawer({ personId, actionId, onClose, onResolve }: ContactDrawerProps) {
  const [person, setPerson] = useState<Person | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [cards, setCards] = useState<ContextCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("liffy_token") : null;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const fetchAll = useCallback(async () => {
    const headers = getHeaders();
    setLoading(true);
    try {
      const [personRes, timelineRes, contextRes] = await Promise.all([
        fetch(`${API_BASE}/api/persons/${personId}`, { headers }),
        fetch(`${API_BASE}/api/timeline/${personId}`, { headers }),
        fetch(`${API_BASE}/api/context/${personId}`, { headers }),
      ]);

      if (personRes.ok) {
        const data = await personRes.json();
        setPerson(data.person || data);
      } else {
        console.warn("[ContactDrawer] Person fetch failed:", personRes.status);
      }
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data.timeline || []);
      } else {
        console.warn("[ContactDrawer] Timeline fetch failed:", timelineRes.status);
      }
      if (contextRes.ok) {
        const data = await contextRes.json();
        setCards(data.cards || []);
      } else {
        console.warn("[ContactDrawer] Context cards failed:", contextRes.status, contextRes.statusText);
      }
    } catch (err) {
      console.error("Failed to fetch drawer data:", err);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/notes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: noteText.trim() }),
      });
      if (res.ok) {
        setNoteText("");
        // Refresh timeline to show new note
        const tlRes = await fetch(`${API_BASE}/api/timeline/${personId}`, { headers });
        if (tlRes.ok) {
          const data = await tlRes.json();
          setTimeline(data.timeline || []);
        }
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const logCall = async () => {
    const headers = getHeaders();
    try {
      await fetch(`${API_BASE}/api/persons/${personId}/notes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Phone call logged" }),
      });
      const tlRes = await fetch(`${API_BASE}/api/timeline/${personId}`, { headers });
      if (tlRes.ok) {
        const data = await tlRes.json();
        setTimeline(data.timeline || []);
      }
    } catch (err) {
      console.error("Failed to log call:", err);
    }
  };

  const personName = person
    ? [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email
    : "";
  const primaryAff = person?.affiliations?.[0];

  const filteredTimeline = timeline.filter((e) => !HIDDEN_EVENTS.has(e.activity_type));

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[480px] max-w-full bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex-shrink-0 border-b p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold truncate">{loading ? "Loading..." : personName}</h2>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {person && (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                {primaryAff?.company_name && (
                  <span>{primaryAff.company_name}</span>
                )}
                {primaryAff?.country_code && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>{primaryAff.country_code}</span>
                  </>
                )}
                {primaryAff?.position && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>{primaryAff.position}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span>{person.email}</span>
                {primaryAff?.phone && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>{primaryAff.phone}</span>
                  </>
                )}
                {person.verification_status && person.verification_status !== "unknown" && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 ${
                      person.verification_status === "valid"
                        ? "text-green-600 border-green-300"
                        : person.verification_status === "invalid"
                        ? "text-red-600 border-red-300"
                        : "text-gray-500"
                    }`}
                  >
                    {person.verification_status}
                  </Badge>
                )}
              </div>
            </>
          )}
        </div>

        {/* Context Cards */}
        {cards.length > 0 && (
          <div className="flex-shrink-0 border-b p-4 space-y-2">
            {cards.map((card, i) => {
              const Icon = CONTEXT_ICONS[card.icon] || Activity;
              return (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 dark:bg-gray-900 rounded-md px-3 py-2">
                  <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>{card.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Timeline</h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filteredTimeline.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-0">
              {filteredTimeline.map((event, i) => {
                const cfg = TIMELINE_ICONS[event.activity_type] || TIMELINE_ICONS.note_added;
                const Icon = cfg.icon;
                return (
                  <div key={i} className="flex gap-3 py-2 border-l-2 border-gray-100 pl-3 ml-1.5 relative">
                    <div className={`absolute -left-[7px] top-3 w-3 h-3 rounded-full border-2 border-white ${
                      event.activity_type === "reply" ? "bg-red-500" :
                      event.activity_type === "click" ? "bg-orange-500" :
                      event.activity_type === "open" ? "bg-yellow-500" :
                      event.activity_type === "sent" ? "bg-blue-500" :
                      "bg-gray-300"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${cfg.color}`} />
                        <span className="text-xs font-medium">{cfg.label}</span>
                        <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                      {event.campaign_name && (
                        <p className="text-[11px] text-gray-500 mt-0.5 ml-5">
                          Campaign: {event.campaign_name}
                        </p>
                      )}
                      {event.link_clicked && (
                        <p className="text-[11px] text-orange-500 mt-0.5 ml-5 truncate">
                          {event.link_clicked}
                        </p>
                      )}
                      {event.detail && event.activity_type === "note_added" && (
                        <p className="text-[11px] text-gray-600 mt-0.5 ml-5 italic">
                          &ldquo;{event.detail.length > 120 ? event.detail.substring(0, 120) + "..." : event.detail}&rdquo;
                          {event.user_name && (
                            <span className="text-gray-400 not-italic"> — {event.user_name}</span>
                          )}
                        </p>
                      )}
                      {event.detail && event.activity_type === "bounce" && (
                        <p className="text-[11px] text-red-500 mt-0.5 ml-5">{event.detail}</p>
                      )}
                      {event.detail && !["note_added", "bounce"].includes(event.activity_type) && event.channel === "system" && (
                        <p className="text-[11px] text-gray-500 mt-0.5 ml-5">{event.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions + Note input */}
        <div className="flex-shrink-0 border-t p-4 space-y-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {actionId && onResolve && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => onResolve(actionId, "done")}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-gray-500 hover:bg-gray-50"
                  onClick={() => onResolve(actionId, "dismissed")}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Dismiss
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={logCall}>
              <Phone className="h-3.5 w-3.5 mr-1" />
              Call Log
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 ml-auto"
              title="Coming soon — use email client for now"
              disabled
            >
              <Mail className="h-3.5 w-3.5 mr-1" />
              Reply
            </Button>
            <a href={`/leads/${personId}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Full
              </Button>
            </a>
          </div>

          {/* Note input */}
          <div className="flex gap-2">
            <textarea
              className="flex-1 border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
              rows={2}
              placeholder="Add a note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  addNote();
                }
              }}
            />
            <Button
              size="sm"
              className="self-end"
              disabled={!noteText.trim() || submitting}
              onClick={addNote}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
