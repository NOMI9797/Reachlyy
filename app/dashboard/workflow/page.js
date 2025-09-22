"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Workflow, Play, Pause, Save, Settings, Plus, Trash2, Edit, Eye } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function WorkflowPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);

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

  // Sample workflow steps
  useEffect(() => {
    if (campaignId) {
      // Load workflow steps for this campaign
      setWorkflowSteps([
        {
          id: 1,
          type: "scrape",
          name: "Scrape Lead Profile",
          description: "Extract profile information and recent posts",
          status: "completed",
          order: 1
        },
        {
          id: 2,
          type: "analyze",
          name: "Analyze Posts",
          description: "Analyze recent posts for engagement patterns",
          status: "completed",
          order: 2
        },
        {
          id: 3,
          type: "generate",
          name: "Generate Message",
          description: "Create personalized message based on analysis",
          status: "pending",
          order: 3
        },
        {
          id: 4,
          type: "send",
          name: "Send Connection Request",
          description: "Send LinkedIn connection request with message",
          status: "pending",
          order: 4
        }
      ]);
    }
  }, [campaignId]);

  const getStepIcon = (type) => {
    switch (type) {
      case "scrape":
        return "🔍";
      case "analyze":
        return "📊";
      case "generate":
        return "✨";
      case "send":
        return "📤";
      default:
        return "⚙️";
    }
  };

  const getStepColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-success text-success-content";
      case "pending":
        return "bg-warning text-warning-content";
      case "error":
        return "bg-error text-error-content";
      default:
        return "bg-base-300 text-base-content";
    }
  };

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
        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-base-300 px-6 py-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => router.back()}
                    className="btn btn-ghost btn-sm gap-2 hover:bg-primary/10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                      <Workflow className="h-5 w-5 text-primary-content" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-base-content">
                        Workflow Designer
                      </h2>
                      {campaignName && (
                        <p className="text-sm text-base-content/60 mt-1">
                          Campaign: {decodeURIComponent(campaignName)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`btn btn-sm gap-2 ${isEditing ? 'btn-primary' : 'btn-outline'}`}
                  >
                    <Edit className="h-4 w-4" />
                    {isEditing ? 'Exit Edit' : 'Edit Workflow'}
                  </button>
                  <button className="btn btn-primary btn-sm gap-2">
                    <Play className="h-4 w-4" />
                    Run Workflow
                  </button>
                </div>
              </div>
            </div>

            {/* Workflow Canvas */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-6xl mx-auto">
                {/* Workflow Steps */}
                <div className="space-y-4">
                  {workflowSteps.map((step, index) => (
                    <div key={step.id} className="relative">
                      {/* Step Card */}
                      <div className={`card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-all ${
                        isEditing ? 'cursor-move' : ''
                      }`}>
                        <div className="card-body p-4">
                          <div className="flex items-center gap-4">
                            {/* Step Number & Icon */}
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                getStepColor(step.status)
                              }`}>
                                {step.status === 'completed' ? '✓' : step.order}
                              </div>
                              <div className="text-2xl">
                                {getStepIcon(step.type)}
                              </div>
                            </div>

                            {/* Step Content */}
                            <div className="flex-1">
                              <h3 className="font-semibold text-base-content">
                                {step.name}
                              </h3>
                              <p className="text-sm text-base-content/60 mt-1">
                                {step.description}
                              </p>
                            </div>

                            {/* Step Status */}
                            <div className="flex items-center gap-2">
                              <div className={`badge badge-sm ${getStepColor(step.status)}`}>
                                {step.status}
                              </div>
                              
                              {isEditing && (
                                <div className="flex items-center gap-1">
                                  <button className="btn btn-ghost btn-sm btn-circle">
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button className="btn btn-ghost btn-sm btn-circle">
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button className="btn btn-ghost btn-sm btn-circle text-error">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Connector Line */}
                      {index < workflowSteps.length - 1 && (
                        <div className="flex justify-center my-2">
                          <div className="w-0.5 h-6 bg-base-300"></div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Step Button */}
                  {isEditing && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setShowAddStepModal(true)}
                        className="btn btn-outline btn-primary gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Step
                      </button>
                    </div>
                  )}
                </div>

                {/* Empty State */}
                {workflowSteps.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Workflow className="h-8 w-8 text-base-content/40" />
                    </div>
                    <h3 className="text-lg font-semibold text-base-content mb-2">
                      No workflow steps yet
                    </h3>
                    <p className="text-base-content/60 mb-6">
                      Create your first automation step to get started
                    </p>
                    <button
                      onClick={() => setShowAddStepModal(true)}
                      className="btn btn-primary gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add First Step
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md mx-auto">
            <div className="flex items-center justify-between p-6 border-b border-base-300">
              <h3 className="text-lg font-semibold text-base-content">
                Add Workflow Step
              </h3>
              <button 
                onClick={() => setShowAddStepModal(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-8 w-8 text-primary" />
                </div>
                <h4 className="text-lg font-medium text-base-content mb-2">
                  Step Builder Coming Soon
                </h4>
                <p className="text-base-content/60 mb-6">
                  This feature will allow you to create custom automation steps for your workflow.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowAddStepModal(false)}
                    className="btn btn-primary"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
