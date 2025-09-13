"use client"

import { useState } from "react"
import { CampaignsList } from "@/components/campaigns-list"
import { CampaignWorkspace } from "@/components/campaign-workspace"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"

export default function Dashboard() {
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection={selectedCampaign ? "campaigns" : "campaigns"}
      />

      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"} flex flex-col`}>
        <TopBar />

        <div className="flex-1">
          {selectedCampaign ? (
            <CampaignWorkspace campaign={selectedCampaign} onBack={() => setSelectedCampaign(null)} />
          ) : (
            <CampaignsList onSelectCampaign={setSelectedCampaign} />
          )}
        </div>
      </div>
    </div>
  )
}
