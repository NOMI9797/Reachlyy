"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Upload,
  Link,
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

interface Lead {
  id: string
  url: string
  name?: string
  title?: string
  company?: string
  status: "pending" | "processing" | "completed" | "error"
  addedAt: string
  posts?: any[]
  profilePicture?: string
}

interface LeadsColumnProps {
  leads: Lead[]
  setLeads: (leads: Lead[] | ((prev: Lead[]) => Lead[])) => void
  selectedLead: Lead | null
  onSelectLead: (lead: Lead) => void
  collapsed: boolean
  onToggleCollapse: () => void
  campaignId: string
  onRefreshLeads: () => void
  loading: boolean
  error: string | null
}

export function LeadsColumn({
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
}: LeadsColumnProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrls, setNewUrls] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [scrapingProgress, setScrapingProgress] = useState(0)
  const [scrapingStatus, setScrapingStatus] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [scrapingSettings, setScrapingSettings] = useState({
    limitPerSource: 2,
    deepScrape: false,
    rawData: false
  })
  const { toast } = useToast()

  const getDisplayName = (lead: Lead) => {
    if (lead.name) return lead.name
    if (lead.status === "processing") return "Processing..."
    
    // Extract name from LinkedIn URL
    const urlMatch = lead.url.match(/linkedin\.com\/in\/([^\/]+)/)
    if (urlMatch) {
      const username = urlMatch[1]
      // Convert username to readable format
      return username.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }
    
    return "LinkedIn Profile"
  }

  const handleImportCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const csv = e.target?.result as string
            const lines = csv.split('\n').filter(line => line.trim())
            
            if (lines.length === 0) {
              toast({
                title: "Import Failed",
                description: "CSV file is empty",
                variant: "destructive",
              })
              return
            }

            // Parse CSV - handle both single column URLs and multi-column formats
            const urls: string[] = []
            
            lines.forEach(line => {
              const trimmedLine = line.trim()
              if (!trimmedLine) return // Skip empty lines
              
              // Check if it's a direct LinkedIn URL (single column format)
              if (trimmedLine.includes('linkedin.com') && !trimmedLine.includes(',')) {
                urls.push(trimmedLine)
              } else {
                // Multi-column format - extract URL from first column
                const columns = trimmedLine.split(',').map(col => col.trim().replace(/"/g, ''))
                const url = columns[0]
                
                if (url && url.includes('linkedin.com')) {
                  urls.push(url)
                }
              }
            })

            if (urls.length === 0) {
              toast({
                title: "Import Failed",
                description: "No valid LinkedIn URLs found in CSV. Make sure URLs contain 'linkedin.com'",
                variant: "destructive",
              })
              return
            }


            // Save leads to database
            const saveLeadsToDatabase = async () => {
              try {
                const response = await fetch(`/api/campaigns/${campaignId}/leads`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ urls }),
                })

                const result = await response.json()

                if (result.success) {
                  const duplicateMessage = result.duplicatesSkipped > 0 
                    ? ` (${result.duplicatesSkipped} duplicates skipped)`
                    : '';
                  
                  toast({
                    title: "Import Successful",
                    description: `Imported ${result.data.length} LinkedIn profile URLs from CSV${duplicateMessage}`,
                  })
                  onRefreshLeads() // Refresh the leads list
                } else {
                  toast({
                    title: "Import Failed",
                    description: result.message || "Failed to save leads to database",
                    variant: "destructive",
                  })
                }
              } catch (error) {
                console.error('Error saving CSV leads:', error)
                toast({
                  title: "Import Failed",
                  description: "Failed to save leads to database",
                  variant: "destructive",
                })
              }
            }

            saveLeadsToDatabase()
          } catch (error) {
            console.error('CSV import error:', error)
            toast({
              title: "Import Failed",
              description: "Failed to parse CSV file",
              variant: "destructive",
            })
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleAddUrls = async () => {
    const urls = newUrls.split("\n").filter((url) => url.trim() && url.includes("linkedin.com"))
    
    if (urls.length === 0) {
      toast({
        title: "No valid URLs",
        description: "Please enter valid LinkedIn profile URLs",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      })

      const result = await response.json()

      if (result.success) {
        const duplicateMessage = result.duplicatesSkipped > 0 
          ? ` (${result.duplicatesSkipped} duplicates skipped)`
          : '';
        
        toast({
          title: "Leads added successfully",
          description: `Added ${result.data.length} leads to campaign${duplicateMessage}`,
        })
        setNewUrls("")
        setShowAddForm(false)
        onRefreshLeads() // Refresh the leads list
      } else {
        toast({
          title: "Failed to add leads",
          description: result.message || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error adding leads:', error)
      toast({
        title: "Error",
        description: "Failed to add leads to campaign",
        variant: "destructive",
      })
    }
  }

  const handleRunSelected = async () => {
    if (!selectedLead) return

    setIsProcessing(true)
    // Set to processing
    const updatedLeads = leads.map((lead) =>
      lead.id === selectedLead.id ? { ...lead, status: "processing" as const } : lead,
    )
    setLeads(updatedLeads)

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: [selectedLead.url],
          limitPerSource: scrapingSettings.limitPerSource,
          deepScrape: scrapingSettings.deepScrape,
          rawData: scrapingSettings.rawData,
          streamProgress: false
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to scrape data')
      }

      const data = await response.json()
      
      if (!data.items || data.items.length === 0) {
        throw new Error('No posts found for this profile')
      }

      // Extract comprehensive lead info from all posts
      const { extractLeadInfo, cleanScrapedPosts } = await import('@/lib/scraping-utils')
      const cleanedPosts = cleanScrapedPosts(data.items)
      const leadInfo = extractLeadInfo(cleanedPosts)
      
      // Save posts to database first
      const postsResponse = await fetch(`/api/leads/${selectedLead.id}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          posts: cleanedPosts
        }),
      })

      if (!postsResponse.ok) {
        console.warn('Failed to save posts to database, but continuing with lead update')
      }
      
      // Update lead with extracted information
      const leadUpdateResponse = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: leadInfo.name,
          title: leadInfo.title,
          company: leadInfo.company,
          status: "completed",
          profilePicture: leadInfo.profilePicture,
          posts: cleanedPosts // Keep posts in lead for backward compatibility
        }),
      })

      if (leadUpdateResponse.ok) {
        // Update local state
        const completedLeads = leads.map((lead) =>
          lead.id === selectedLead.id
            ? {
                ...lead,
                status: "completed" as const,
                name: leadInfo.name,
                title: leadInfo.title,
                company: leadInfo.company,
                posts: cleanedPosts,
                profilePicture: leadInfo.profilePicture
              }
            : lead,
        )
        setLeads(completedLeads)
        
        toast({
          title: "Scraping Complete",
          description: `Successfully scraped ${cleanedPosts.length} posts for ${leadInfo.name}`,
        })
      } else {
        throw new Error('Failed to save lead data to database')
      }
    } catch (error) {
      console.error('Scraping error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      toast({
        title: "Scraping Failed",
        description: `Failed to scrape ${selectedLead.url}: ${errorMessage}`,
        variant: "destructive",
      })
      
      // Update lead status to error in database
      try {
        await fetch(`/api/leads/${selectedLead.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: "error"
          }),
        })
      } catch (updateError) {
        console.error('Failed to update lead status to error:', updateError)
      }

      const errorLeads = leads.map((lead) =>
        lead.id === selectedLead.id ? { ...lead, status: "error" as const } : lead,
      )
      setLeads(errorLeads)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRunAll = async () => {
    const pendingLeads = leads.filter((lead) => lead.status === "pending")
    if (pendingLeads.length === 0) return

    setIsProcessing(true)
    setScrapingProgress(0)
    setScrapingStatus("Starting scraping...")
    
    // Set all pending leads to processing
    setLeads((prev: Lead[]) => 
      prev.map((lead: Lead) => 
        pendingLeads.some(pending => pending.id === lead.id) 
          ? { ...lead, status: "processing" as const }
          : lead
      )
    )

    try {
      const urls = pendingLeads.map(lead => lead.url)
      
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls,
          limitPerSource: scrapingSettings.limitPerSource,
          deepScrape: scrapingSettings.deepScrape,
          rawData: scrapingSettings.rawData,
          streamProgress: true
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to scrape data')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                // Update progress and status
                if (data.progress !== undefined) {
                  setScrapingProgress(data.progress)
                }
                if (data.status) {
                  setScrapingStatus(data.status)
                }
                
                if (data.completed && data.items) {
                  // Process results and update leads
                  const itemsBySource = new Map()
                  data.items.forEach((item: any) => {
                    const sourceUrl = item.sourceUrl
                    if (!itemsBySource.has(sourceUrl)) {
                      itemsBySource.set(sourceUrl, [])
                    }
                    itemsBySource.get(sourceUrl).push(item)
                  })

                  // Process each lead and save to database
                  const { extractLeadInfo, cleanScrapedPosts } = await import('@/lib/scraping-utils')
                  let completedCount = 0
                  let totalPosts = 0

                  for (const lead of pendingLeads) {
                    const leadItems = itemsBySource.get(lead.url) || []
                    
                    if (leadItems.length > 0) {
                      try {
                        // Clean and extract lead info
                        const cleanedPosts = cleanScrapedPosts(leadItems)
                        const leadInfo = extractLeadInfo(cleanedPosts)
                        
                        // Save posts to database
                        const postsResponse = await fetch(`/api/leads/${lead.id}/posts`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            posts: cleanedPosts
                          }),
                        })

                        if (!postsResponse.ok) {
                          console.warn(`Failed to save posts for lead ${lead.id}`)
                        }
                        
                        // Update lead with extracted information
                        const leadUpdateResponse = await fetch(`/api/leads/${lead.id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            name: leadInfo.name,
                            title: leadInfo.title,
                            company: leadInfo.company,
                            status: "completed",
                            profilePicture: leadInfo.profilePicture,
                            posts: cleanedPosts // Keep posts in lead for backward compatibility
                          }),
                        })

                        if (leadUpdateResponse.ok) {
                          completedCount++
                          totalPosts += cleanedPosts.length
                        } else {
                          console.warn(`Failed to update lead ${lead.id}`)
                        }
                      } catch (error) {
                        console.error(`Error processing lead ${lead.id}:`, error)
                      }
                    }
                  }

                  // Update local state with database data
                  setLeads((prev: Lead[]) =>
                    prev.map((lead: Lead) => {
                      if (pendingLeads.some(pending => pending.id === lead.id)) {
                        const leadItems = itemsBySource.get(lead.url) || []
                        
                        if (leadItems.length > 0) {
                          const cleanedPosts = cleanScrapedPosts(leadItems)
                          const leadInfo = extractLeadInfo(cleanedPosts)
                          
                          return {
                            ...lead,
                            status: "completed" as const,
                            name: leadInfo.name,
                            title: leadInfo.title,
                            company: leadInfo.company,
                            posts: cleanedPosts,
                            profilePicture: leadInfo.profilePicture
                          }
                        } else {
                          return {
                            ...lead,
                            status: "error" as const
                          }
                        }
                      }
                      return lead
                    })
                  )
                  
                  toast({
                    title: "Scraping Complete",
                    description: `Successfully scraped ${completedCount} leads with ${totalPosts} total posts`,
                  })
                } else if (data.error) {
                  // Handle error from streaming
                  toast({
                    title: "Scraping Failed",
                    description: `Scraping failed: ${data.error}`,
                    variant: "destructive",
                  })
                  
                  // Update error status in database for all pending leads
                  for (const lead of pendingLeads) {
                    try {
                      await fetch(`/api/leads/${lead.id}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          status: "error"
                        }),
                      })
                    } catch (updateError) {
                      console.error(`Failed to update lead ${lead.id} status to error:`, updateError)
                    }
                  }
                  
                  setLeads((prev: Lead[]) =>
                    prev.map((lead: Lead) =>
                      pendingLeads.some(pending => pending.id === lead.id)
                        ? { ...lead, status: "error" as const }
                        : lead
                    )
                  )
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Scraping error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      toast({
        title: "Scraping Failed",
        description: `Failed to scrape leads: ${errorMessage}`,
        variant: "destructive",
      })
      
      // Update error status in database for all pending leads
      for (const lead of pendingLeads) {
        try {
          await fetch(`/api/leads/${lead.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: "error"
            }),
          })
        } catch (updateError) {
          console.error(`Failed to update lead ${lead.id} status to error:`, updateError)
        }
      }

      setLeads((prev: Lead[]) =>
        prev.map((lead: Lead) =>
          pendingLeads.some(pending => pending.id === lead.id)
            ? { ...lead, status: "error" as const }
            : lead
        )
      )
    } finally {
      setIsProcessing(false)
      setScrapingProgress(0)
      setScrapingStatus("")
    }
  }

  const getStatusIcon = (status: Lead["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusColor = (status: Lead["status"]) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    }
  }

  const filteredLeads = leads.filter(
    (lead) =>
      !searchQuery ||
      lead.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 bg-background">
        <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="mb-4 p-2">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="writing-mode-vertical text-sm text-muted-foreground">Leads ({leads.length})</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">Leads</h2>
            <Badge variant="secondary">{leads.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="p-1">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-3">
          <Button size="sm" onClick={handleRunSelected} disabled={!selectedLead || isProcessing} className="flex-1">
            <Play className="h-3 w-3 mr-1" />
            Run Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunAll}
            disabled={leads.length === 0 || isProcessing}
            className="flex-1 bg-transparent"
          >
            <Play className="h-3 w-3 mr-1" />
            Run All
          </Button>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Scraping Progress</span>
              <span className="text-xs text-muted-foreground">{scrapingProgress}%</span>
            </div>
            <Progress value={scrapingProgress} className="h-2" />
            {scrapingStatus && (
              <p className="text-xs text-muted-foreground mt-1">{scrapingStatus}</p>
            )}
          </div>
        )}

        {/* Add Leads Buttons */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)} className="flex-1">
            <Plus className="h-3 w-3 mr-1" />
            Add URLs
          </Button>
          <Button size="sm" variant="outline" onClick={handleImportCSV} className="flex-1 bg-transparent">
            <Upload className="h-3 w-3 mr-1" />
            Import CSV
          </Button>
        </div>

        {/* Settings Button */}
        <div className="flex justify-center mt-2">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-3 w-3 mr-1" />
            Scraping Settings
          </Button>
        </div>
      </div>

      {/* Add URLs Form */}
      {showAddForm && (
        <div className="p-4 border-b border-border bg-muted/30">
          <Textarea
            placeholder="Paste LinkedIn URLs (one per line)..."
            value={newUrls}
            onChange={(e) => setNewUrls(e.target.value)}
            rows={4}
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddUrls} disabled={!newUrls.trim()}>
              Add Leads
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Scraping Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="text-sm font-medium mb-3">Scraping Configuration</h3>
          
          {/* Limit Per Source */}
          <div className="mb-3">
            <Label htmlFor="limitPerSource" className="text-xs text-muted-foreground">
              Posts per Profile
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="limitPerSource"
                type="number"
                min="1"
                max="50"
                value={scrapingSettings.limitPerSource}
                onChange={(e) => setScrapingSettings(prev => ({
                  ...prev,
                  limitPerSource: parseInt(e.target.value) || 2
                }))}
                className="w-16 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">
                posts per LinkedIn profile
              </span>
            </div>
          </div>

          {/* Deep Scrape */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label htmlFor="deepScrape" className="text-xs font-medium">
                Deep Scrape
              </Label>
              <p className="text-xs text-muted-foreground">
                Scrape more detailed information
              </p>
            </div>
            <Switch
              id="deepScrape"
              checked={scrapingSettings.deepScrape}
              onCheckedChange={(checked) => setScrapingSettings(prev => ({
                ...prev,
                deepScrape: checked
              }))}
            />
          </div>

          {/* Raw Data */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label htmlFor="rawData" className="text-xs font-medium">
                Raw Data
              </Label>
              <p className="text-xs text-muted-foreground">
                Include raw HTML and metadata
              </p>
            </div>
            <Switch
              id="rawData"
              checked={scrapingSettings.rawData}
              onCheckedChange={(checked) => setScrapingSettings(prev => ({
                ...prev,
                rawData: checked
              }))}
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowSettings(false)} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Leads List */}
      <div className="flex-1 overflow-y-auto">
        {filteredLeads.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Link className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No leads yet</p>
            <p className="text-xs">Add LinkedIn URLs to get started</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredLeads.map((lead) => (
              <Card
                key={lead.id}
                className={`cursor-pointer transition-all hover:shadow-sm ${
                  selectedLead?.id === lead.id ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => onSelectLead(lead)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Profile Picture or Status Icon */}
                    {lead.profilePicture ? (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={lead.profilePicture} alt={getDisplayName(lead)} />
                        <AvatarFallback className="text-xs">
                          {getDisplayName(lead).split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center">
                        {getStatusIcon(lead.status)}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm text-foreground truncate">
                          {getDisplayName(lead)}
                        </h4>
                        <Badge className={`text-xs ${getStatusColor(lead.status)}`}>{lead.status}</Badge>
                      </div>
                      {lead.title && (
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.title} {lead.company && `at ${lead.company}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate mt-1">{lead.url}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
