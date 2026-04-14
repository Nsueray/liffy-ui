"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Database,
  Users,
  List,
  Target,
  Send,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  HelpCircle,
  Sparkles,
  Mail,
  Activity,
  ShieldCheck,
  BarChart3,
  Search,
  CheckSquare,
  Kanban,
  Shield,
  Zap,
} from "lucide-react";
import { logoutClient } from "@/lib/auth";

// Menu configuration with icons
const menuItems = [
  {
    name: "Action",
    href: "/",
    icon: Zap,
    description: "Action items & follow-ups",
    badge: { type: "warning", count: 0 }
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview and analytics"
  },
  {
    name: "Mining Jobs",
    href: "/mining/jobs",
    icon: Database,
    description: "Data extraction jobs",
    badge: { type: "info", count: 0 } // Will be updated dynamically
  },
  {
    name: "Source Discovery",
    href: "/source-discovery",
    icon: Search,
    description: "AI-powered source finder"
  },
  {
    name: "Contacts",
    href: "/leads",
    icon: Users,
    description: "Manage contacts",
    badge: { type: "success", count: 0 }
  },
  { 
    name: "Lists", 
    href: "/lists", 
    icon: List,
    description: "Lead lists & segments"
  },
  { 
    name: "Prospects", 
    href: "/prospects", 
    icon: Target,
    description: "Qualified prospects"
  },
  {
    name: "Verification",
    href: "/verification",
    icon: ShieldCheck,
    description: "Email verification"
  },
  {
    name: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
    description: "My follow-up tasks",
    badge: { type: "warning", count: 0 }
  },
  {
    name: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
    description: "Sales pipeline board"
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    icon: Send,
    description: "Email campaigns",
    badge: { type: "warning", count: 0 }
  },
  {
    name: "Templates",
    href: "/templates",
    icon: FileText,
    description: "Email templates"
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    description: "Campaign reports"
  },
];

const bottomMenuItems = [
  {
    name: "Admin",
    href: "/admin",
    icon: Shield,
    description: "User management",
    adminOnly: true,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Account settings"
  },
  {
    name: "Help & Support",
    href: "/help",
    icon: HelpCircle,
    description: "Get help"
  },
];

interface SidebarProps {
  defaultCollapsed?: boolean;
}

export function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mounted, setMounted] = useState(false);
  
  // Dynamic counts (fetch from API in real app)
  const [counts, setCounts] = useState({
    runningJobs: 0,
    newLeads: 0,
    activeCampaigns: 0,
    overdueTasks: 0,
    actionOpen: 0,
  });

  // Current user loaded from localStorage
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    role: string;
    organizer_name?: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);

    // Load collapsed state from localStorage
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      setCollapsed(JSON.parse(savedState));
    }

    // Load current user from localStorage (set by login page)
    try {
      const rawUser = localStorage.getItem("liffy_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        // Support both { user: {...}, organizer: {...} } and flat shapes
        const user = parsed.user || parsed;
        const organizer = parsed.organizer || {};
        setCurrentUser({
          email: user.email || "",
          role: user.role || "",
          organizer_name: organizer.name || "",
        });
      }
    } catch {}

    // Fetch dynamic counts
    let stopped = false;

    const fetchCounts = async () => {
      if (stopped) return;
      const token = localStorage.getItem('liffy_token');
      if (!token) return;

      try {
        const response = await fetch("/api/stats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setCounts((prev) => ({ ...prev, ...data }));
        } else if (response.status === 401) {
          // Token expired or invalid — stop polling to avoid console spam
          stopped = true;
        }
      } catch {}
    };

    const fetchTasksSummary = async () => {
      if (stopped) return;
      const token = localStorage.getItem('liffy_token');
      if (!token) return;

      try {
        const response = await fetch("/api/tasks/summary", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setCounts((prev) => ({
            ...prev,
            overdueTasks: data.overdue_count || 0,
          }));
        } else if (response.status === 401) {
          stopped = true;
        }
      } catch {}
    };

    const fetchActionSummary = async () => {
      if (stopped) return;
      const token = localStorage.getItem('liffy_token');
      if (!token) return;

      try {
        const response = await fetch("/api/actions/summary", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setCounts((prev) => ({
            ...prev,
            actionOpen: data.total_open || 0,
          }));
        } else if (response.status === 401) {
          stopped = true;
        }
      } catch {}
    };

    fetchCounts();
    fetchTasksSummary();
    fetchActionSummary();
    const interval = setInterval(() => {
      fetchCounts();
      fetchTasksSummary();
      fetchActionSummary();
    }, 30000);

    return () => { stopped = true; clearInterval(interval); };
  }, []);

  const handleLogout = async () => {
    await logoutClient();
    router.push("/login");
  };

  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  // Update menu items with dynamic badges
  const menu = menuItems.map(item => {
    if (item.name === "Action" && counts.actionOpen > 0) {
      return { ...item, badge: { type: "warning", count: counts.actionOpen } };
    }
    if (item.name === "Mining Jobs" && counts.runningJobs > 0) {
      return { ...item, badge: { type: "info", count: counts.runningJobs } };
    }
    if (item.name === "Contacts" && counts.newLeads > 0) {
      return { ...item, badge: { type: "success", count: counts.newLeads } };
    }
    if (item.name === "Tasks" && counts.overdueTasks > 0) {
      return { ...item, badge: { type: "warning", count: counts.overdueTasks } };
    }
    if (item.name === "Campaigns" && counts.activeCampaigns > 0) {
      return { ...item, badge: { type: "warning", count: counts.activeCampaigns } };
    }
    return item;
  });

  if (!mounted) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "relative flex flex-col h-screen bg-white dark:bg-gray-950 border-r dark:border-gray-800 transition-all duration-300 ease-in-out",
          collapsed ? "w-[70px]" : "w-64"
        )}
      >
        {/* Header with Logo */}
        <div className={cn(
          "flex items-center p-4",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/liffy-logo.png"
                alt="Liffy"
                width={collapsed ? 40 : 48}
                height={collapsed ? 40 : 48}
                className="rounded-lg transition-all"
                priority
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  Liffy
                </span>
                <span className="text-xs text-gray-500">
                  Mining Platform
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn(
              "h-8 w-8",
              collapsed && "absolute -right-3 bg-white dark:bg-gray-900 border shadow-sm"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Separator className="mx-4" />

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const button = (
              <Link key={item.href} href={item.href} className="block">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full transition-all duration-200",
                    collapsed ? "px-2" : "justify-start",
                    isActive
                      ? "bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
                      : "hover:bg-orange-50 dark:hover:bg-gray-800 hover:text-orange-600"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    collapsed ? "" : "mr-3"
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.name}</span>
                      {item.badge && item.badge.count > 0 && (
                        <span
                          className={cn(
                            "ml-auto px-2 py-0.5 text-xs rounded-full font-medium",
                            item.badge.type === "info" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                            item.badge.type === "success" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                            item.badge.type === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                            isActive && "bg-orange-400 text-white"
                          )}
                        >
                          {item.badge.count > 99 ? "99+" : item.badge.count}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    {item.badge && item.badge.count > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                        {item.badge.count}
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}

          {/* Separator before bottom menu */}
          <div className="py-2">
            <Separator />
          </div>

          {/* Bottom Menu Items */}
          {bottomMenuItems.filter((item) => {
            if ((item as any).adminOnly) {
              const role = currentUser?.role;
              return role === 'owner' || role === 'admin';
            }
            return true;
          }).map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const button = (
              <Link key={item.href} href={item.href} className="block">
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full transition-all duration-200",
                    collapsed ? "px-2" : "justify-start",
                    isActive
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : "hover:bg-orange-50 dark:hover:bg-gray-800 hover:text-orange-600"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    collapsed ? "" : "mr-3"
                  )} />
                  {!collapsed && (
                    <span className="flex-1 text-left">{item.name}</span>
                  )}
                </Button>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </nav>

        <Separator className="mx-4" />

        {/* User Section */}
        <div className="p-3">
          {/* Notifications */}
          <Button
            variant="ghost"
            className={cn(
              "w-full mb-2 relative",
              collapsed ? "px-2" : "justify-start"
            )}
          >
            <Bell className={cn(
              "h-4 w-4",
              collapsed ? "" : "mr-3"
            )} />
            {!collapsed && <span className="flex-1 text-left">Notifications</span>}
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          {/* User Profile */}
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-900 mb-2",
            collapsed && "justify-center"
          )}>
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-medium">
                {(currentUser?.email || "?").substring(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {currentUser?.organizer_name || currentUser?.email?.split("@")[0] || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {currentUser?.email || ""}
                </p>
                {currentUser?.role && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 uppercase">
                    {currentUser.role}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className={cn(
                  "w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20",
                  collapsed ? "px-2" : "justify-start"
                )}
              >
                <LogOut className={cn(
                  "h-4 w-4",
                  collapsed ? "" : "mr-3"
                )} />
                {!collapsed && <span>Logout</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                Logout
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Version Badge */}
        {!collapsed && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Sparkles className="h-3 w-3" />
              <span>v1.0.0 Beta</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Optional: Export a layout wrapper
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Optional: Top header bar */}
        <header className="h-14 border-b bg-white dark:bg-gray-950 dark:border-gray-800 flex items-center px-6">
          <h1 className="text-lg font-semibold">Welcome back!</h1>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
