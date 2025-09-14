"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Settings, Maximize2, Minimize2, Zap, Target, MessageSquare, BarChart3 } from "lucide-react";
import LeadsColumn from "./LeadsColumn";
import PostsColumn from "./PostsColumn";
import AIResponseColumn from "./AIResponseColumn";

export default function CampaignWorkspace({ campaign, onBack }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columnWidths, setColumnWidths] = useState([35, 30, 35]); // percentages
  const [collapsedColumns, setCollapsedColumns] = useState(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeColumn, setActiveColumn] = useState(null); // For right-side modal
  
  // Settings state
  const [scrapingSettings, setScrapingSettings] = useState({
    limitPerSource: 2,
    deepScrape: false,
    rawData: false,
  });
  const [aiSettings, setAiSettings] = useState({
    model: "llama-3.1-8b-instant",
    customPrompt: "",
  });

  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragColumn = useRef(-1);

  // Fetch leads for this campaign
  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/campaigns/${campaign.id}/leads`);
      const result = await response.json();

      if (result.success) {
        setLeads(result.leads);
      } else {
        setError(result.message || "Failed to fetch leads");
      }
    } catch (err) {
      setError("Failed to fetch leads");
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaign?.id) {
      fetchLeads();
    }
  }, [campaign?.id]);

  const refreshLeads = () => {
    fetchLeads();
  };

  // Column resizing logic
  const handleMouseDown = (columnIndex) => (e) => {
    isDragging.current = true;
    dragColumn.current = columnIndex;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    const newWidths = [...columnWidths];
    if (dragColumn.current === 0) {
      newWidths[0] = Math.max(20, Math.min(60, percentage));
      newWidths[1] = Math.max(20, 100 - newWidths[0] - newWidths[2]);
    } else if (dragColumn.current === 1) {
      const totalLeft = newWidths[0] + percentage;
      newWidths[1] = Math.max(20, Math.min(60, percentage));
      newWidths[2] = Math.max(20, 100 - newWidths[0] - newWidths[1]);
    }

    setColumnWidths(newWidths);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    dragColumn.current = -1;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const toggleColumn = (columnIndex) => {
    const newCollapsed = new Set(collapsedColumns);
    if (newCollapsed.has(columnIndex)) {
      newCollapsed.delete(columnIndex);
    } else {
      newCollapsed.add(columnIndex);
    }
    setCollapsedColumns(newCollapsed);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? "fixed inset-0 z-50 bg-base-100" : ""}`}>
      {/* Modern Campaign Header with Stats */}
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-base-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={onBack}
              className="btn btn-ghost btn-sm gap-2 hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Target className="h-5 w-5 text-primary-content" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-base-content">{campaign.name}</h2>
                {campaign.description && (
                  <p className="text-sm text-base-content/60 mt-1">{campaign.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{leads?.length || 0}</div>
                <div className="text-xs text-base-content/60">Leads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{leads?.filter(l => l.status === 'completed').length || 0}</div>
                <div className="text-xs text-base-content/60">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-info">0</div>
                <div className="text-xs text-base-content/60">Messages</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="btn btn-ghost btn-sm btn-circle hover:bg-primary/10"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Three Column Layout with Floating Controls */}
      <div ref={containerRef} className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-base-100 relative">
        {/* Column 1: Leads - Enhanced with floating action */}
        <div
          className={`bg-base-100 border-r border-base-300 transition-all duration-300 relative ${
            collapsedColumns.has(0) ? "w-12" : "w-full lg:w-auto h-80 lg:h-auto"
          }`}
          style={{ 
            width: collapsedColumns.has(0) ? "48px" : `${columnWidths[0]}%`
          }}
        >
          <LeadsColumn
            leads={leads}
            setLeads={setLeads}
            selectedLead={selectedLead}
            onSelectLead={setSelectedLead}
            collapsed={collapsedColumns.has(0)}
            onToggleCollapse={() => toggleColumn(0)}
            campaignId={campaign.id}
            onRefreshLeads={refreshLeads}
            loading={loading}
            error={error}
            onOpenSettings={() => setActiveColumn('leads')}
            scrapingSettings={scrapingSettings}
            setScrapingSettings={setScrapingSettings}
          />
          
          {/* Floating Column Config */}
          {!collapsedColumns.has(0) && (
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setActiveColumn('leads')}
                className="btn btn-sm btn-circle btn-ghost bg-base-100/80 backdrop-blur-sm border border-base-300 shadow-lg hover:bg-primary/10"
                title="Configure Leads"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Resize Handle 1 */}
        {!collapsedColumns.has(0) && !collapsedColumns.has(1) && (
          <div
            className="w-1 bg-base-300 hover:bg-primary/30 cursor-col-resize transition-all duration-200 hover:w-2"
            onMouseDown={handleMouseDown(0)}
          />
        )}

        {/* Column 2: Posts - Enhanced with engagement insights */}
        <div
          className={`bg-base-100 border-r border-base-300 transition-all duration-300 relative ${
            collapsedColumns.has(1) ? "w-12" : "w-full lg:w-auto h-80 lg:h-auto"
          }`}
          style={{ width: collapsedColumns.has(1) ? "48px" : `${columnWidths[1]}%` }}
        >
          <PostsColumn
            selectedLead={selectedLead}
            collapsed={collapsedColumns.has(1)}
            onToggleCollapse={() => toggleColumn(1)}
            onOpenSettings={() => setActiveColumn('posts')}
          />
          
          {/* Floating Column Config */}
          {!collapsedColumns.has(1) && (
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setActiveColumn('posts')}
                className="btn btn-sm btn-circle btn-ghost bg-base-100/80 backdrop-blur-sm border border-base-300 shadow-lg hover:bg-primary/10"
                title="Configure Posts"
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Resize Handle 2 */}
        {!collapsedColumns.has(1) && !collapsedColumns.has(2) && (
          <div
            className="w-1 bg-base-300 hover:bg-primary/30 cursor-col-resize transition-all duration-200 hover:w-2"
            onMouseDown={handleMouseDown(1)}
          />
        )}

        {/* Column 3: AI Response - Enhanced with smart suggestions */}
        <div
          className={`bg-base-100 transition-all duration-300 relative ${
            collapsedColumns.has(2) ? "w-12" : "w-full lg:w-auto h-80 lg:h-auto"
          }`}
          style={{ width: collapsedColumns.has(2) ? "48px" : `${columnWidths[2]}%` }}
        >
          <AIResponseColumn
            selectedLead={selectedLead}
            campaignId={campaign?.id}
            collapsed={collapsedColumns.has(2)}
            onToggleCollapse={() => toggleColumn(2)}
            onOpenSettings={() => setActiveColumn('ai')}
            aiSettings={aiSettings}
            setAiSettings={setAiSettings}
          />
          
          {/* Floating Column Config */}
          {!collapsedColumns.has(2) && (
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setActiveColumn('ai')}
                className="btn btn-sm btn-circle btn-ghost bg-base-100/80 backdrop-blur-sm border border-base-300 shadow-lg hover:bg-primary/10"
                title="Configure AI"
              >
                <Zap className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right-side Configuration Modal */}
      {activeColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="bg-black/50 w-full h-full" onClick={() => setActiveColumn(null)} />
          <div className="bg-base-100 w-full sm:w-96 h-full shadow-2xl border-l border-base-300 animate-in slide-in-from-right">
            <div className="p-6 border-b border-base-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-base-content">
                  {activeColumn === 'leads' && 'Leads Configuration'}
                  {activeColumn === 'posts' && 'Posts Analysis'}
                  {activeColumn === 'ai' && 'AI Settings'}
                </h3>
                <button
                  onClick={() => setActiveColumn(null)}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              {activeColumn === 'leads' && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Scraping Configuration</h4>
                  
                  {/* Posts per Profile */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Posts per Profile</span>
                      <span className="label-text-alt">{scrapingSettings.limitPerSource}</span>
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max="20" 
                      value={scrapingSettings.limitPerSource}
                      onChange={(e) => setScrapingSettings(prev => ({
                        ...prev,
                        limitPerSource: parseInt(e.target.value)
                      }))}
                      className="range range-primary" 
                    />
                    <div className="w-full flex justify-between text-xs px-2">
                      <span>1</span>
                      <span>10</span>
                      <span>20</span>
                    </div>
                  </div>
                  
                  {/* Deep Scrape Toggle */}
                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <div>
                        <span className="label-text">Deep Scrape</span>
                        <div className="text-xs text-base-content/60">Scrape more detailed information</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={scrapingSettings.deepScrape}
                        onChange={(e) => setScrapingSettings(prev => ({
                          ...prev,
                          deepScrape: e.target.checked
                        }))}
                        className="toggle toggle-primary" 
                      />
                    </label>
                  </div>
                  
                  {/* Raw Data Toggle */}
                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <div>
                        <span className="label-text">Raw Data</span>
                        <div className="text-xs text-base-content/60">Include raw HTML and metadata</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={scrapingSettings.rawData}
                        onChange={(e) => setScrapingSettings(prev => ({
                          ...prev,
                          rawData: e.target.checked
                        }))}
                        className="toggle toggle-primary" 
                      />
                    </label>
                  </div>
                </div>
              )}
              {activeColumn === 'posts' && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Analysis Settings</h4>
                  <div className="stats stats-vertical">
                    <div className="stat">
                      <div className="stat-title">Engagement Score</div>
                      <div className="stat-value text-primary">8.5</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Post Frequency</div>
                      <div className="stat-value text-success">2.3/week</div>
                    </div>
                  </div>
                </div>
              )}
              {activeColumn === 'ai' && (
                <div className="space-y-4">
                  <h4 className="font-semibold">AI Configuration</h4>
                  
                  {/* Model Selection */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">AI Model</span>
                    </label>
                    <select 
                      className="select select-bordered"
                      value={aiSettings.model}
                      onChange={(e) => setAiSettings(prev => ({
                        ...prev,
                        model: e.target.value
                      }))}
                    >
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</option>
                      <option value="llama3-8b-8192">Llama 3 8B</option>
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                      <option value="gemma-7b-it">Gemma 7B</option>
                    </select>
                  </div>
                  
                  {/* Custom Prompt */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Custom Prompt</span>
                      <span className="label-text-alt">{aiSettings.customPrompt.length}/500</span>
                    </label>
                    <textarea 
                      className="textarea textarea-bordered h-24" 
                      placeholder="Add custom instructions for message generation..."
                      value={aiSettings.customPrompt}
                      onChange={(e) => setAiSettings(prev => ({
                        ...prev,
                        customPrompt: e.target.value.slice(0, 500)
                      }))}
                    />
                  </div>
                  
                  {/* Model Info */}
                  <div className="alert alert-info">
                    <div className="text-sm">
                      <div className="font-medium">Current: {aiSettings.model}</div>
                      <div className="text-xs opacity-70">
                        {aiSettings.model === 'llama-3.1-8b-instant' && 'Fast and efficient for quick responses'}
                        {aiSettings.model === 'mixtral-8x7b-32768' && 'Balanced performance and quality'}
                        {aiSettings.model === 'llama3-8b-8192' && 'Good balance of speed and accuracy'}
                        {aiSettings.model === 'gemma-7b-it' && 'Optimized for instruction following'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
