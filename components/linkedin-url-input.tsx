"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Play, PlayCircle, Trash2, Plus, ExternalLink, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Lead {
  id: string
  url: string
  status: "pending" | "running" | "completed" | "error"
  name?: string
  title?: string
  company?: string
  progress?: number
}

interface LinkedInUrlInputProps {
  leads: Lead[]
  setLeads: (leads: Lead[]) => void
  onSelectLead: (lead: Lead | null) => void
  selectedLead: Lead | null
  runningLeads: Set<string>
  setRunningLeads: (running: Set<string>) => void
}

export function LinkedInUrlInput({
  leads,
  setLeads,
  onSelectLead,
  selectedLead,
  runningLeads,
  setRunningLeads,
}: LinkedInUrlInputProps) {
  const [urlInput, setUrlInput] = useState("")
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())

  const addUrls = () => {
    const urls = urlInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url && url.includes("linkedin.com"))

    const newLeads: Lead[] = urls.map((url) => ({
      id: Math.random().toString(36).substr(2, 9),
      url,
      status: "pending" as const,
    }))

    setLeads([...leads, ...newLeads])
    setUrlInput("")
  }

  const runSelected = () => {
    const leadsToRun = leads.filter((lead) => selectedLeads.has(lead.id))
    leadsToRun.forEach((lead) => {
      setRunningLeads((prev) => new Set([...prev, lead.id]))
      // Simulate processing
      setTimeout(
        () => {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id
                ? { ...l, status: "completed", name: "John Doe", title: "Software Engineer", company: "Tech Corp" }
                : l,
            ),
          )
          setRunningLeads((prev) => {
            const newSet = new Set(prev)
            newSet.delete(lead.id)
            return newSet
          })
        },
        Math.random() * 3000 + 2000,
      )
    })
  }

  const runAll = () => {
    const allPendingIds = new Set(leads.filter((l) => l.status === "pending").map((l) => l.id))
    setSelectedLeads(allPendingIds)
    setTimeout(() => runSelected(), 100)
  }

  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId)
    } else {
      newSelected.add(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const deleteLead = (leadId: string) => {
    setLeads(leads.filter((l) => l.id !== leadId))
    if (selectedLead?.id === leadId) {
      onSelectLead(null)
    }
  }

  const getStatusColor = (status: Lead["status"]) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      case "running":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      case "error":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
    }
  }

  return (
    <div className="space-y-6">
      {/* URL Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add LinkedIn Profile URLs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste LinkedIn profile URLs (one per line)&#10;https://linkedin.com/in/johndoe&#10;https://linkedin.com/in/janedoe"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
          />
          <Button onClick={addUrls} disabled={!urlInput.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add URLs ({urlInput.split("\n").filter((url) => url.trim() && url.includes("linkedin.com")).length})
          </Button>
        </CardContent>
      </Card>

      {/* Leads Management */}
      {leads.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">LinkedIn Leads ({leads.length})</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={runSelected} disabled={selectedLeads.size === 0}>
                  <Play className="h-4 w-4 mr-2" />
                  Run Selected ({selectedLeads.size})
                </Button>
                <Button size="sm" onClick={runAll} disabled={leads.filter((l) => l.status === "pending").length === 0}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Run All Pending
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                    selectedLead?.id === lead.id && "bg-primary/10 border-primary",
                  )}
                  onClick={() => onSelectLead(lead)}
                >
                  <Checkbox
                    checked={selectedLeads.has(lead.id)}
                    onCheckedChange={() => toggleLeadSelection(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusColor(lead.status)}>
                        {runningLeads.has(lead.id) ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Processing
                          </>
                        ) : (
                          lead.status
                        )}
                      </Badge>
                      {lead.name && <span className="font-medium text-sm">{lead.name}</span>}
                    </div>

                    {lead.title && lead.company && (
                      <p className="text-sm text-muted-foreground mb-1">
                        {lead.title} at {lead.company}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{lead.url}</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteLead(lead.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
