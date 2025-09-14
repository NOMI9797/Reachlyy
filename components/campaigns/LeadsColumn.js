"use client";

import { useState, memo } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Upload,
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Link,
  User,
  MapPin,
} from "lucide-react";

const LeadsColumn = memo(function LeadsColumn({
  leads,
  setLeads,
  selectedLead,
  onSelectLead,
  collapsed,
  onToggleCollapse,
  campaignId,
  onRefreshLeads,
  loading,
  error,
  onOpenSettings,
  scrapingSettings,
  setScrapingSettings,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrls, setNewUrls] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState({});

  const getDisplayName = (lead) => {
    if (lead.name) return lead.name;
    if (lead.status === "processing") return "Processing...";

    // Extract name from LinkedIn URL
    const urlMatch = lead.url.match(/linkedin\.com\/in\/([^\/]+)/);
    if (urlMatch) {
      const username = urlMatch[1];
      return username
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    return "LinkedIn Profile";
  };

  const handleImportCSV = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const csv = e.target?.result;
            const lines = csv.split("\n").filter((line) => line.trim());

            if (lines.length === 0) {
              alert("CSV file is empty");
              return;
            }

            const urls = [];
            lines.forEach((line) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return;

              if (trimmedLine.includes("linkedin.com") && !trimmedLine.includes(",")) {
                urls.push(trimmedLine);
              } else {
                const columns = trimmedLine.split(",").map((col) => col.trim().replace(/"/g, ""));
                const url = columns[0];
                if (url && url.includes("linkedin.com")) {
                  urls.push(url);
                }
              }
            });

            if (urls.length === 0) {
              toast.error("No valid LinkedIn URLs found in CSV");
              return;
            }

            handleAddUrls(urls);
          } catch (error) {
            console.error("CSV import error:", error);
            toast.error("Failed to parse CSV file");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleAddUrls = async (urls = null) => {
    const urlsToAdd = urls || newUrls.split("\n").filter((url) => url.trim() && url.includes("linkedin.com"));

    if (urlsToAdd.length === 0) {
      alert("Please enter valid LinkedIn profile URLs");
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls: urlsToAdd }),
      });

      const result = await response.json();

      if (result.success) {
        setNewUrls("");
        setShowAddForm(false);
        onRefreshLeads();
        toast.success(`Successfully added ${result.leads?.length || urlsToAdd.length} leads!`);
      } else {
        toast.error(result.message || "Failed to add leads");
      }
    } catch (error) {
      console.error("Error adding leads:", error);
      toast.error("Failed to add leads to campaign");
    }
  };

  const checkScrapingStatus = async (leadId) => {
    try {
      const response = await fetch(`/api/scrape?leadIds=${leadId}`);
      const result = await response.json();
      
      if (result.success && result.leads.length > 0) {
        const lead = result.leads[0];
        setScrapingProgress(prev => ({
          ...prev,
          [leadId]: {
            status: lead.status,
            progress: lead.status === 'processing' ? 50 : lead.status === 'completed' ? 100 : 0,
            message: lead.status === 'processing' ? 'Scraping profile data...' : 
                    lead.status === 'completed' ? 'Scraping completed!' : 
                    lead.status === 'error' ? lead.errorMessage : 'Starting...'
          }
        }));
        return lead;
      }
    } catch (error) {
      console.error("Error checking scraping status:", error);
    }
    return null;
  };

  const handleRunSelected = async () => {
    if (!selectedLead) return;

    const leadId = selectedLead._id || selectedLead.id;
    if (!leadId) {
      toast.error("Invalid lead ID");
      return;
    }

    setIsProcessing(true);
    setScrapingProgress(prev => ({
      ...prev,
      [leadId]: {
        status: 'processing',
        progress: 0,
        message: 'Starting scraping...'
      }
    }));

    const updatedLeads = leads.map((lead) =>
      (lead._id || lead.id) === leadId ? { ...lead, status: "processing" } : lead
    );
    setLeads(updatedLeads);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: [selectedLead.url],
          limitPerSource: scrapingSettings?.limitPerSource ?? 10,
          deepScrape: scrapingSettings?.deepScrape ?? true,
          rawData: scrapingSettings?.rawData ?? false,
          streamProgress: false
        }),
      });

      const result = await response.json();

      if (result.items && result.items.length > 0) {
        // Process scraped data exactly like Reachly
        const { extractLeadInfo, cleanScrapedPosts } = await import('@/libs/scraping-utils');
        const cleanedPosts = cleanScrapedPosts(result.items);
        const leadInfo = extractLeadInfo(cleanedPosts);
        
        console.log("Extracted lead info:", leadInfo);
        console.log("Profile picture URL:", leadInfo.profilePicture);

        // Save posts to database
        try {
          const postsResponse = await fetch(`/api/leads/${leadId}/posts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              posts: cleanedPosts
            }),
          });
          
          if (!postsResponse.ok) {
            console.warn('Failed to save posts to database, but continuing with lead update');
          }
        } catch (postError) {
          console.warn('Error saving posts:', postError);
        }

        // Update lead in database
        try {
          const leadUpdateResponse = await fetch(`/api/leads/${leadId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: leadInfo.name,
              title: leadInfo.title,
              company: leadInfo.company,
              location: leadInfo.location,
              profilePicture: leadInfo.profilePicture,
              status: 'completed'
            }),
          });
          
          if (!leadUpdateResponse.ok) {
            console.warn('Failed to update lead in database');
          }
        } catch (leadError) {
          console.warn('Error updating lead:', leadError);
        }

        setScrapingProgress(prev => ({
          ...prev,
          [leadId]: {
            status: 'completed',
            progress: 100,
            message: `Found ${cleanedPosts.length} posts`
          }
        }));

        const completedLeads = leads.map((lead) =>
          (lead._id || lead.id) === leadId
            ? {
                ...lead,
                status: "completed",
                name: leadInfo.name,
                title: leadInfo.title,
                company: leadInfo.company,
                location: leadInfo.location,
                profilePicture: leadInfo.profilePicture,
                postsCount: cleanedPosts.length,
              }
            : lead
        );
        setLeads(completedLeads);
        toast.success(`Successfully scraped ${cleanedPosts.length} posts from ${leadInfo.name}!`);
      } else {
        throw new Error(result.error || "No posts found for this profile");
      }
    } catch (error) {
      console.error("Scraping error:", error);
      setScrapingProgress(prev => ({
        ...prev,
        [leadId]: {
          status: 'error',
          progress: 0,
          message: error.message
        }
      }));

      const errorLeads = leads.map((lead) =>
        (lead._id || lead.id) === leadId ? { ...lead, status: "error" } : lead
      );
      setLeads(errorLeads);
      toast.error(`Scraping failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunAll = async () => {
    const pendingLeads = leads.filter(lead => lead.status === "pending" || lead.status === "error");
    
    if (pendingLeads.length === 0) {
      toast.error("No pending leads to scrape");
      return;
    }

    setIsProcessing(true);
    
    // Set progress for all leads
    const progressUpdates = {};
    pendingLeads.forEach(lead => {
      const leadId = lead._id || lead.id;
      progressUpdates[leadId] = {
        status: 'processing',
        progress: 0,
        message: 'Starting scraping...'
      };
    });
    setScrapingProgress(prev => ({ ...prev, ...progressUpdates }));

    // Update all leads to processing
    const updatedLeads = leads.map((lead) => {
      const leadId = lead._id || lead.id;
      const isPending = pendingLeads.some(pending => (pending._id || pending.id) === leadId);
      return isPending ? { ...lead, status: "processing" } : lead;
    });
    setLeads(updatedLeads);

    try {
      // Extract URLs from pending leads (like Reachly)
      const urls = pendingLeads.map(lead => lead.url);
      
      console.log("Sending URLs to scrape:", urls);
      console.log("Pending leads:", pendingLeads);
      
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: urls,
          limitPerSource: scrapingSettings?.limitPerSource ?? 10,
          deepScrape: scrapingSettings?.deepScrape ?? true,
          rawData: scrapingSettings?.rawData ?? false,
          streamProgress: false
        }),
      });

      const result = await response.json();
      
      console.log("Scraping API response:", result);

      if (result.items && result.items.length > 0) {
        // Process scraped data exactly like Reachly
        const { extractLeadInfo, cleanScrapedPosts } = await import('@/libs/scraping-utils');
        
        // Group items by source URL
        const itemsByUrl = {};
        result.items.forEach(item => {
          const sourceUrl = item.sourceUrl;
          if (!itemsByUrl[sourceUrl]) {
            itemsByUrl[sourceUrl] = [];
          }
          itemsByUrl[sourceUrl].push(item);
        });

        let successCount = 0;
        let errorCount = 0;

        // Process each lead
        const updatedLeads = await Promise.all(leads.map(async (lead) => {
          const leadId = lead._id || lead.id;
          const isPendingLead = pendingLeads.some(pending => (pending._id || pending.id) === leadId);
          
          if (!isPendingLead) {
            return lead; // Not being processed
          }

          const leadItems = itemsByUrl[lead.url] || [];
          
          if (leadItems.length > 0) {
            try {
              // Clean the posts
              const cleanedPosts = cleanScrapedPosts(leadItems);
              const leadInfo = extractLeadInfo(cleanedPosts);
              
              console.log(`Lead info for ${url}:`, leadInfo);
              console.log(`Profile picture for ${url}:`, leadInfo.profilePicture);

              // Save posts to database
              try {
                const postsResponse = await fetch(`/api/leads/${leadId}/posts`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    posts: cleanedPosts
                  }),
                });
                
                if (!postsResponse.ok) {
                  console.warn('Failed to save posts to database, but continuing with lead update');
                }
              } catch (postError) {
                console.warn('Error saving posts:', postError);
              }

              // Update lead in database
              try {
                const leadUpdateResponse = await fetch(`/api/leads/${leadId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    name: leadInfo.name,
                    title: leadInfo.title,
                    company: leadInfo.company,
                    location: leadInfo.location,
                    profilePicture: leadInfo.profilePicture,
                    status: 'completed'
                  }),
                });
                
                if (!leadUpdateResponse.ok) {
                  console.warn('Failed to update lead in database');
                }
              } catch (leadError) {
                console.warn('Error updating lead:', leadError);
              }

              setScrapingProgress(prev => ({
                ...prev,
                [leadId]: {
                  status: 'completed',
                  progress: 100,
                  message: `Found ${cleanedPosts.length} posts`
                }
              }));

              successCount++;
              
              return {
                ...lead,
                status: "completed",
                name: leadInfo.name,
                title: leadInfo.title,
                company: leadInfo.company,
                location: leadInfo.location,
                profilePicture: leadInfo.profilePicture,
                postsCount: cleanedPosts.length,
              };
            } catch (error) {
              console.error(`Error processing lead ${leadId}:`, error);
              
              setScrapingProgress(prev => ({
                ...prev,
                [leadId]: {
                  status: 'error',
                  progress: 0,
                  message: 'Failed to process scraped data'
                }
              }));
              
              errorCount++;
              return { ...lead, status: "error" };
            }
          } else {
            // No data found for this lead
            setScrapingProgress(prev => ({
              ...prev,
              [leadId]: {
                status: 'error',
                progress: 0,
                message: 'No posts found for this profile'
              }
            }));
            
            errorCount++;
            return { ...lead, status: "error" };
          }
        }));

        setLeads(updatedLeads);

        if (successCount > 0) {
          toast.success(`Successfully scraped ${successCount} leads!`);
        }
        if (errorCount > 0) {
          toast.error(`${errorCount} leads failed to scrape`);
        }
      } else {
        throw new Error(result.error || "No posts found");
      }
    } catch (error) {
      console.error("Scraping error:", error);
      
      // Set all to error
      const errorUpdates = {};
      pendingLeads.forEach(lead => {
        const leadId = lead._id || lead.id;
        errorUpdates[leadId] = {
          status: 'error',
          progress: 0,
          message: error.message
        };
      });
      setScrapingProgress(prev => ({ ...prev, ...errorUpdates }));

      const errorLeads = leads.map((lead) => {
        const leadId = lead._id || lead.id;
        const isPending = pendingLeads.some(pending => (pending._id || pending.id) === leadId);
        return isPending ? { ...lead, status: "error" } : lead;
      });
      setLeads(errorLeads);
      toast.error(`Scraping failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-base-content/40" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "error":
        return <XCircle className="h-4 w-4 text-error" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "badge-neutral";
      case "processing":
        return "badge-primary";
      case "completed":
        return "badge-success";
      case "error":
        return "badge-error";
    }
  };

  const filteredLeads = leads.filter(
    (lead) =>
      !searchQuery ||
      lead.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 bg-base-100">
        <button
          onClick={onToggleCollapse}
          className="btn btn-ghost btn-sm btn-circle mb-4"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="writing-mode-vertical text-sm text-base-content/60">
          Leads ({leads.length})
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="p-4 border-b border-base-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base-content">Leads</h2>
            <div className="badge badge-primary badge-sm">{leads.length}</div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search leads..."
            className="input input-bordered w-full pl-9 input-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={handleRunSelected}
            disabled={!selectedLead || isProcessing}
            className="btn btn-primary btn-sm gap-1"
          >
            <Play className="h-3 w-3" />
            Run Selected
          </button>
          <button
            onClick={handleRunAll}
            disabled={isProcessing || leads.filter(lead => lead.status === "pending" || lead.status === "error").length === 0}
            className="btn btn-secondary btn-sm gap-1"
          >
            <Play className="h-3 w-3" />
            Run All
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-outline btn-sm gap-1"
          >
            <Plus className="h-3 w-3" />
            Add URLs
          </button>
          <button
            onClick={handleImportCSV}
            className="btn btn-outline btn-sm gap-1"
          >
            <Upload className="h-3 w-3" />
            Import CSV
          </button>
        </div>
      </div>

      {/* Add URLs Form */}
      {showAddForm && (
        <div className="p-4 border-b border-base-300 bg-base-200">
          <textarea
            placeholder="Paste LinkedIn URLs (one per line)..."
            className="textarea textarea-bordered w-full mb-3 textarea-sm"
            rows={4}
            value={newUrls}
            onChange={(e) => setNewUrls(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAddUrls()}
              disabled={!newUrls.trim()}
              className="btn btn-primary btn-sm"
            >
              Add Leads
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Leads List */}
      <div className="flex-1 overflow-y-auto">
        {filteredLeads.length === 0 ? (
          <div className="p-4 text-center text-base-content/60">
            <Link className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No leads yet</p>
            <p className="text-xs">Add LinkedIn URLs to get started</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredLeads.map((lead) => (
              <div
                key={lead._id || lead.id}
                className={`card bg-base-100 border border-base-300 cursor-pointer transition-all hover:shadow-sm ${
                  (selectedLead?._id || selectedLead?.id) === (lead._id || lead.id)
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-base-200"
                }`}
                onClick={() => onSelectLead(lead)}
              >
                <div className="card-body p-3">
                  <div className="flex items-start gap-3">
                    {/* Profile Picture or Status Icon */}
                    {lead.profilePicture ? (
                      <div className="avatar">
                        <div className="w-8 h-8 rounded-full">
                          <img 
                            src={lead.profilePicture} 
                            alt={getDisplayName(lead)}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div 
                            className="w-full h-full bg-primary text-primary-content rounded-full flex items-center justify-center text-xs font-medium"
                            style={{ display: 'none' }}
                          >
                            {getDisplayName(lead).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-medium">
                        {lead.status === 'processing' ? (
                          <div className="loading loading-spinner loading-xs"></div>
                        ) : (
                          getDisplayName(lead).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm text-base-content truncate">
                          {getDisplayName(lead)}
                        </h4>
                        <div className={`badge badge-sm ${getStatusColor(lead.status)}`}>
                          {lead.status}
                        </div>
                      </div>

                      {lead.title && (
                        <div className="flex items-center gap-1 text-xs text-base-content/60 mb-1">
                          <User className="h-3 w-3" />
                          <span className="truncate">{lead.title}</span>
                        </div>
                      )}

                      {lead.location && (
                        <div className="flex items-center gap-1 text-xs text-base-content/60 mb-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{lead.location}</span>
                        </div>
                      )}

                      <p className="text-xs text-base-content/40 truncate mt-1">
                        {lead.url}
                      </p>

                      {/* Progress Bar for Processing Leads */}
                      {lead.status === "processing" && scrapingProgress[lead._id || lead.id] && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-xs text-base-content/60">
                            <span>{scrapingProgress[lead._id || lead.id].message}</span>
                            <span>{scrapingProgress[lead._id || lead.id].progress}%</span>
                          </div>
                          <progress
                            className="progress progress-primary w-full h-1"
                            value={scrapingProgress[lead._id || lead.id].progress}
                            max="100"
                          ></progress>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default LeadsColumn;
