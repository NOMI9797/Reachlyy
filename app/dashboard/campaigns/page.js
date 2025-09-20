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

  // Background pre-fetch campaigns to Redis on page load
  useEffect(() => {
    if (session?.user?.id) {
      // Trigger background pre-fetch (logs will show in terminal)
      fetch('/api/redis-workflow/campaigns/pre-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id }),
      })
      .then(response => response.json())
      .then(data => {
        // Silent success - logs are in terminal
      })
      .catch(error => {
        // Silent error - logs are in terminal
      });
    }
  }, [session?.user?.id]);

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
    <div className="min-h-screen bg-base-100 flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="campaigns"
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${
        sidebarCollapsed ? "ml-16" : "ml-64"
      } flex flex-col`}>
        {/* Top Bar */}
        <TopBar title="Campaigns" />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
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

