"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, Loader2 } from "lucide-react"
import { LeadsColumn } from "@/components/leads-column"
import { PostsColumn } from "@/components/posts-column"
import { AIResponseColumn } from "@/components/ai-response-column"

interface Lead {
  id: string
  url: string
  name?: string
  title?: string
  company?: string
  status: "pending" | "processing" | "completed" | "error"
  profilePicture?: string
  posts?: any[]
  addedAt: string
  createdAt: string
  updatedAt: string
}

interface CampaignWorkspaceProps {
  campaign: any
  onBack: () => void
}

export function CampaignWorkspace({ campaign, onBack }: CampaignWorkspaceProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [columnWidths, setColumnWidths] = useState([33, 33, 34]) // percentages
  const [collapsedColumns, setCollapsedColumns] = useState<Set<number>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragColumn = useRef<number>(-1)

  // Fetch leads for this campaign
  const fetchLeads = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/campaigns/${campaign.id}/leads`)
      const result = await response.json()
      
      if (result.success) {
        setLeads(result.data)
      } else {
        setError(result.message || 'Failed to fetch leads')
      }
    } catch (err) {
      setError('Failed to fetch leads')
      console.error('Error fetching leads:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load leads when campaign changes
  useEffect(() => {
    if (campaign?.id) {
      fetchLeads()
    }
  }, [campaign?.id])

  // Function to refresh leads after adding new ones
  const refreshLeads = () => {
    fetchLeads()
  }

  const handleMouseDown = (columnIndex: number) => (e: React.MouseEvent) => {
    isDragging.current = true
    dragColumn.current = columnIndex
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    e.preventDefault()
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = (x / rect.width) * 100

    const newWidths = [...columnWidths]
    if (dragColumn.current === 0) {
      newWidths[0] = Math.max(20, Math.min(60, percentage))
      newWidths[1] = Math.max(20, 100 - newWidths[0] - newWidths[2])
    } else if (dragColumn.current === 1) {
      const totalLeft = newWidths[0] + percentage
      newWidths[1] = Math.max(20, Math.min(60, percentage))
      newWidths[2] = Math.max(20, 100 - newWidths[0] - newWidths[1])
    }

    setColumnWidths(newWidths)
  }

  const handleMouseUp = () => {
    isDragging.current = false
    dragColumn.current = -1
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
  }

  const toggleColumn = (columnIndex: number) => {
    const newCollapsed = new Set(collapsedColumns)
    if (newCollapsed.has(columnIndex)) {
      newCollapsed.delete(columnIndex)
    } else {
      newCollapsed.add(columnIndex)
    }
    setCollapsedColumns(newCollapsed)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Campaign Info Bar - simplified without duplicate header */}
      <div className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Campaigns
            </Button>
            <div>
              <h2 className="text-lg font-medium text-card-foreground">{campaign.name}</h2>
              {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Three Column Layout */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Column 1: Leads */}
        <div
          className={`border-r border-border bg-background transition-all duration-200 ${
            collapsedColumns.has(0) ? "w-12" : ""
          }`}
          style={{ width: collapsedColumns.has(0) ? "48px" : `${columnWidths[0]}%` }}
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
          />
        </div>

        {/* Resize Handle 1 */}
        {!collapsedColumns.has(0) && !collapsedColumns.has(1) && (
          <div
            className="w-1 bg-border hover:bg-primary/20 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown(0)}
          />
        )}

        {/* Column 2: Posts */}
        <div
          className={`border-r border-border bg-background transition-all duration-200 ${
            collapsedColumns.has(1) ? "w-12" : ""
          }`}
          style={{ width: collapsedColumns.has(1) ? "48px" : `${columnWidths[1]}%` }}
        >
          <PostsColumn
            selectedLead={selectedLead}
            collapsed={collapsedColumns.has(1)}
            onToggleCollapse={() => toggleColumn(1)}
          />
        </div>

        {/* Resize Handle 2 */}
        {!collapsedColumns.has(1) && !collapsedColumns.has(2) && (
          <div
            className="w-1 bg-border hover:bg-primary/20 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown(1)}
          />
        )}

        {/* Column 3: AI Response */}
        <div
          className={`bg-background transition-all duration-200 ${collapsedColumns.has(2) ? "w-12" : ""}`}
          style={{ width: collapsedColumns.has(2) ? "48px" : `${columnWidths[2]}%` }}
        >
          <AIResponseColumn
            selectedLead={selectedLead}
            campaignId={campaign?.id}
            collapsed={collapsedColumns.has(2)}
            onToggleCollapse={() => toggleColumn(2)}
          />
        </div>
      </div>
    </div>
  )
}
