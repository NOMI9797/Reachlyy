"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Target, Users, MessageSquare, Settings, ChevronRight, BarChart3 } from "lucide-react"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  activeSection?: string
}

export function Sidebar({ collapsed, onToggle, activeSection = "campaigns" }: SidebarProps) {
  const menuItems = [
    { icon: Target, label: "Campaigns", key: "campaigns" },
    { icon: Users, label: "Leads", key: "leads" },
    { icon: MessageSquare, label: "Messages", key: "messages" },
    { icon: BarChart3, label: "Analytics", key: "analytics" },
    { icon: Settings, label: "Settings", key: "settings" },
  ]

  return (
    <div
      className={cn(
        "bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col fixed left-0 top-0 h-full z-50",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="p-4 border-b border-sidebar-border">
        <Button variant="ghost" size="sm" onClick={onToggle} className="w-full justify-start">
          <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
          {!collapsed && <span className="ml-2 font-semibold text-sidebar-foreground">Reachly</span>}
        </Button>
      </div>

      <nav className="flex-1 p-2">
        {menuItems.map((item) => (
          <Button
            key={item.key}
            variant={activeSection === item.key ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "w-full justify-start mb-1 transition-colors",
              collapsed ? "px-2" : "px-3",
              activeSection === item.key && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && <span className="ml-3">{item.label}</span>}
          </Button>
        ))}
      </nav>
    </div>
  )
}
