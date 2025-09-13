"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
}

interface LeadsColumnProps {
  campaign: any
  leads: Lead[]
  setLeads: (leads: Lead[]) => void
  selectedLead: Lead | null
  onSelectLead: (lead: Lead) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function LeadsColumn({
  campaign,
  leads,
  setLeads,
  selectedLead,
  onSelectLead,
  collapsed,
  onToggleCollapse,
}: LeadsColumnProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrls, setNewUrls] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAddUrls = () => {
    const urls = newUrls.split("\n").filter((url) => url.trim())
    const newLeads: Lead[] = urls.map((url) => ({
      id: Date.now().toString() + Math.random(),
      url: url.trim(),
      status: "pending" as const,
      addedAt: new Date().toISOString(),
    }))

    setLeads([...leads, ...newLeads])
    setNewUrls("")
    setShowAddForm(false)
  }

  const handleRunSelected = async () => {
    if (!selectedLead) return

    setIsProcessing(true)
    // Simulate processing
    const updatedLeads = leads.map((lead) =>
      lead.id === selectedLead.id ? { ...lead, status: "processing" as const } : lead,
    )
    setLeads(updatedLeads)

    // Simulate completion after 2 seconds
    setTimeout(() => {
      const completedLeads = leads.map((lead) =>
        lead.id === selectedLead.id
          ? {
              ...lead,
              status: "completed" as const,
              name: "John Doe",
              title: "Software Engineer",
              company: "Tech Corp",
            }
          : lead,
      )
      setLeads(completedLeads)
      setIsProcessing(false)
    }, 2000)
  }

  const handleRunAll = async () => {
    setIsProcessing(true)
    const pendingLeads = leads.filter((lead) => lead.status === "pending")

    // Process leads one by one
    for (let i = 0; i < pendingLeads.length; i++) {
      const lead = pendingLeads[i]

      // Set to processing
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "processing" as const } : l)))

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Set to completed
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                status: "completed" as const,
                name: `Lead ${i + 1}`,
                title: "Professional",
                company: "Company Inc",
              }
            : l,
        ),
      )
    }

    setIsProcessing(false)
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

        {/* Add Leads Buttons */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)} className="flex-1">
            <Plus className="h-3 w-3 mr-1" />
            Add URLs
          </Button>
          <Button size="sm" variant="outline" className="flex-1 bg-transparent">
            <Upload className="h-3 w-3 mr-1" />
            Import CSV
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
                  <div className="flex items-start gap-2">
                    {getStatusIcon(lead.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm text-foreground truncate">{lead.name || "Processing..."}</h4>
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
