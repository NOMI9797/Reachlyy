"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import CampaignsList from "@/app/dashboard/campaigns/components/CampaignsList";
import CampaignWorkspace from "@/app/dashboard/campaigns/components/CampaignWorkspace";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function CampaignsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return; // Still loading
    if (!session) {
      router.push("/");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg text-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <div className="h-screen bg-base-100 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="campaigns"
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${
        sidebarCollapsed ? "ml-16" : "ml-64"
      } flex flex-col h-full overflow-hidden`}>
        {/* Top Bar */}
        <div className="flex-shrink-0">
          <TopBar title="Campaigns" />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden min-h-0">
          {selectedCampaign ? (
            <CampaignWorkspace
              campaign={selectedCampaign}
              onBack={() => setSelectedCampaign(null)}
            />
          ) : (
            <CampaignsList onSelectCampaign={setSelectedCampaign} />
          )}
        </div>
      </div>
    </div>
  );
}

