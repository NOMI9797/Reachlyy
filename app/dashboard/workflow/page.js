"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import WorkflowLayout from "./components/WorkflowLayout";
import AudienceTab from "./components/AudienceTab";
import SequenceCanvas from "./components/SequenceCanvas";
import StatisticsTab from "./components/StatisticsTab";
import SettingsTab from "./components/SettingsTab";

export default function WorkflowPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Get campaign info from URL parameters
  const campaignName = searchParams.get('campaign');
  const campaignId = searchParams.get('campaignId');

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
    }
  }, [session, status, router]);

  // Legacy mock list removed

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg text-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-100 flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="workflow"
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${
        sidebarCollapsed ? "ml-16" : "ml-64"
      } flex flex-col h-screen overflow-hidden`}>
        {/* Top Bar */}
        <div className="flex-shrink-0">
          <TopBar title="Workflow Designer" />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <WorkflowLayout
              campaignName={campaignName}
              campaignId={campaignId}
              AudienceTab={AudienceTab}
              SequenceTab={SequenceCanvas}
              StatisticsTab={StatisticsTab}
              SettingsTab={SettingsTab}
            />
          </div>
        </div>
      </div>

      
    </div>
  );
}
