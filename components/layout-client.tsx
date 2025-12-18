"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar"; // Import the new Sidebar
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  Search, 
  Bell, 
  User, 
  Settings,
  LogOut,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logoutClient } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

export function LayoutClient({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  
  // Pages that don't need authentication/shell
  const publicPages = ["/login", "/register", "/forgot-password"];
  const isPublicPage = publicPages.includes(pathname);

  // 🔒 Authentication check
  useEffect(() => {
    if (isPublicPage) return;
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("liffy_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // Get user info from token or localStorage (mock for now)
    const userData = localStorage.getItem("liffy_user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        setUser({ name: "Elan Admin", email: "admin@elan-expo.com" });
      }
    } else {
      // Mock user for development
      setUser({ name: "Elan Admin", email: "admin@elan-expo.com" });
    }
  }, [isPublicPage, router]);

  // Public pages - no shell
  if (isPublicPage) {
    return <>{children}</>;
  }

  const handleLogout = useCallback(async () => {
    await logoutClient();
    router.push("/login");
  }, [router]);

  // Get page title from pathname
  const getPageTitle = () => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "Dashboard";
    
    // Special cases
    if (pathname.startsWith("/mining/jobs/new")) return "New Mining Job";
    if (pathname.startsWith("/mining/jobs/") && segments.length > 2) {
      if (pathname.includes("/console")) return "Job Console";
      if (pathname.includes("/results")) return "Job Results";
      return "Mining Job Details";
    }
    if (pathname === "/mining/jobs") return "Mining Jobs";
    
    // Default: capitalize last segment
    const lastSegment = segments[segments.length - 1];
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-full transition-transform duration-300 md:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-white dark:bg-gray-950 border-b dark:border-gray-800 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Page title & breadcrumb */}
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {getPageTitle()}
              </h1>
              <nav className="hidden md:flex items-center gap-1 text-xs text-gray-500">
                <span>Home</span>
                {pathname !== "/dashboard" && (
                  <>
                    <span>/</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {pathname.split("/").filter(Boolean).join(" / ")}
                    </span>
                  </>
                )}
              </nav>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Search button (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Search bar (desktop) */}
            <div className="hidden md:flex items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-1.5 text-sm border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2 md:px-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-medium">
                    {user?.name?.split(" ").map(n => n[0]).join("") || "U"}
                  </div>
                  <span className="hidden md:block text-sm font-medium">
                    {user?.name || "User"}
                  </span>
                  <ChevronDown className="hidden md:block h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Environment Badge */}
            {process.env.NODE_ENV === "development" && (
              <div className="hidden md:flex items-center px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-md">
                DEV
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6 max-w-7xl">
            {children}
          </div>
        </main>

        {/* Optional: Footer */}
        <footer className="hidden md:block border-t dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>© 2025 Liffy by Elan Expo</span>
              <span>•</span>
              <a href="#" className="hover:text-gray-700">Documentation</a>
              <span>•</span>
              <a href="#" className="hover:text-gray-700">Support</a>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>All systems operational</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Optional: Export a simple hook to get current user
export function useCurrentUser() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("liffy_user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        setUser({ name: "Elan Admin", email: "admin@elan-expo.com" });
      }
    }
  }, []);

  return user;
}

// Optional: Page wrapper component for consistent spacing
export function PageWrapper({ 
  children, 
  title,
  description,
  actions 
}: { 
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {(title || description || actions) && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            )}
            {description && (
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
