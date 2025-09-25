"use client";

import { useState } from "react";
import { Users, Workflow, BarChart3, Settings as SettingsIcon } from "lucide-react";

export default function WorkflowLayout({
  campaignName,
  campaignId,
  AudienceTab,
  SequenceTab,
  StatisticsTab,
  SettingsTab,
}) {
  const [activeTab, setActiveTab] = useState("sequence");

  const tabs = [
    { id: "audience", label: "Audience", icon: Users },
    { id: "sequence", label: "Sequence", icon: Workflow },
    { id: "statistics", label: "Statistics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-base-300 bg-base-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`tab tab-lg tab-lifted whitespace-nowrap flex items-center gap-2 ${
                  activeTab === t.id ? "tab-active" : ""
                }`}
                title={t.label}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
            <div className="ml-auto text-xs text-base-content/60 py-3 pr-2">
              {campaignName && (
                <span>Campaign: {decodeURIComponent(campaignName)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "audience" && <AudienceTab campaignId={campaignId} />}
        {activeTab === "sequence" && <SequenceTab campaignId={campaignId} />}
        {activeTab === "statistics" && <StatisticsTab campaignId={campaignId} />}
        {activeTab === "settings" && <SettingsTab campaignId={campaignId} />}
      </div>
    </div>
  );
}



