"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Target,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserCheck,
  Workflow,
} from "lucide-react";

const menuItems = [
  { 
    icon: Target, 
    label: "Campaigns", 
    href: "/dashboard/campaigns",
    key: "campaigns" 
  },
  { 
    icon: Users, 
    label: "Leads", 
    href: "/dashboard/leads",
    key: "leads" 
  },
  { 
    icon: MessageSquare, 
    label: "Messages", 
    href: "/dashboard/messages",
    key: "messages" 
  },
  { 
    icon: BarChart3, 
    label: "Analytics", 
    href: "/dashboard/analytics",
    key: "analytics" 
  },
  { 
    icon: UserCheck, 
    label: "Accounts", 
    href: "/dashboard/accounts",
    key: "accounts" 
  },
  { 
    icon: Workflow, 
    label: "Workflows", 
    href: "/dashboard/workflow",
    key: "workflow" 
  },
  { 
    icon: Settings, 
    label: "Settings", 
    href: "/dashboard/settings",
    key: "settings" 
  },
];

export default function Sidebar({ collapsed, onToggle, activeSection = "campaigns" }) {
  const pathname = usePathname();

  return (
    <div className={`bg-base-200 border-r border-base-300 transition-all duration-300 flex flex-col fixed left-0 top-0 h-full z-50 ${
      collapsed ? "w-16" : "w-64"
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-base-300">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-primary-content" />
              </div>
              <span className="font-bold text-lg text-base-content">Reachly</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || activeSection === item.key;
            
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`btn btn-ghost w-full justify-start gap-3 h-12 ${
                  isActive 
                    ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15" 
                    : "text-base-content hover:bg-base-300 hover:text-base-content"
                } ${collapsed ? "px-2" : "px-4"}`}
              >
                <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                {!collapsed && <span className={`truncate font-medium ${isActive ? "text-primary" : ""}`}>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        {!collapsed && (
          <div className="mt-6 p-2">
            <div className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">
              Quick Actions
            </div>
            <button className="btn btn-primary btn-sm w-full gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </button>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-base-300">
        {!collapsed ? (
          <div className="text-xs text-base-content/60 text-center">
            <div className="font-semibold">Reachly v1.0</div>
            <div>LinkedIn Outreach Tool</div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Target className="h-4 w-4 text-primary-content" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

