"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Clock, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopNavProps {
  actionCount?: number;
}

const tabs = [
  { href: "/", label: "Action", icon: Zap, iconColor: "text-orange-500" },
  { href: "/waiting", label: "Waiting", icon: Clock, iconColor: "text-blue-500" },
  { href: "/dashboard", label: "Overview", icon: BarChart3, iconColor: "text-green-500" },
];

export function TopNav({ actionCount }: TopNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b mb-6">
      {tabs.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? "border-orange-500 text-gray-900 dark:text-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? tab.iconColor : ""}`} />
            {tab.label}
            {tab.href === "/" && actionCount != null && actionCount > 0 && (
              <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0 ml-1">
                {actionCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );
}
