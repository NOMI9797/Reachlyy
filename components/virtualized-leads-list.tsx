"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, Send, Search, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

interface Lead {
  id: string
  name: string
  title: string
  company: string
  avatar: string
  postsFetched: boolean
  messageGenerated: boolean
  messageSent: boolean
  isProcessing: boolean
  lastActivity: string
}

const generateMockLeads = (count: number): Lead[] => {
  const titles = ["CEO", "VP of Marketing", "Marketing Director", "Growth Manager", "Head of Sales", "Product Manager"]
  const companies = ["TechFlow Inc", "StartupX", "ScaleUp Co", "InnovateLab", "GrowthCorp", "DataTech", "CloudSoft"]
  const names = [
    "Sarah Chen",
    "Michael Rodriguez",
    "Emily Johnson",
    "David Kim",
    "Lisa Wang",
    "James Brown",
    "Maria Garcia",
  ]

  return Array.from({ length: count }, (_, i) => ({
    id: `lead-${i}`,
    name: names[i % names.length] + ` ${i}`,
    title: titles[i % titles.length],
    company: companies[i % companies.length],
    avatar: `/professional-${i % 4 === 0 ? "woman-diverse" : i % 4 === 1 ? "man" : i % 4 === 2 ? "blonde-woman" : "asian-man"}.png`,
    postsFetched: i % 3 !== 0,
    messageGenerated: i % 4 !== 0,
    messageSent: i % 5 === 0,
    isProcessing: i % 7 === 0,
    lastActivity: i % 2 === 0 ? "Just now" : `${Math.floor(Math.random() * 60)} minutes ago`,
  }))
}

interface VirtualizedLeadsListProps {
  onSelectLead: (lead: Lead) => void
  selectedLead: Lead | null
}

export function VirtualizedLeadsList({ onSelectLead, selectedLead }: VirtualizedLeadsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const leadsPerPage = 50

  const allLeads = useMemo(() => generateMockLeads(5000), [])

  const filteredLeads = useMemo(() => {
    return allLeads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.title.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [allLeads, searchQuery])

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * leadsPerPage
    return filteredLeads.slice(startIndex, startIndex + leadsPerPage)
  }, [filteredLeads, currentPage, leadsPerPage])

  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage)

  const getStatusBadges = (lead: Lead) => {
    const badges = []

    if (lead.isProcessing) {
      badges.push(
        <Badge key="processing" variant="secondary" className="text-xs">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>,
      )
    }

    if (lead.postsFetched) {
      badges.push(
        <Badge key="posts" variant="outline" className="text-xs">
          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
          Posts
        </Badge>,
      )
    }

    if (lead.messageGenerated) {
      badges.push(
        <Badge key="message" variant="outline" className="text-xs">
          <CheckCircle className="h-3 w-3 mr-1 text-blue-600" />
          Message
        </Badge>,
      )
    }

    if (lead.messageSent) {
      badges.push(
        <Badge key="sent" variant="outline" className="text-xs">
          <Send className="h-3 w-3 mr-1 text-purple-600" />
          Sent
        </Badge>,
      )
    }

    return badges
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Leads</CardTitle>
          <Badge variant="outline">{filteredLeads.length.toLocaleString()}</Badge>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-1">
              {paginatedLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={cn(
                    "p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedLead?.id === lead.id && "bg-muted",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={lead.avatar || "/placeholder.svg"} />
                      <AvatarFallback>
                        {lead.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-sm truncate">{lead.name}</h3>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{lead.lastActivity}</span>
                      </div>

                      <p className="text-sm text-muted-foreground truncate">
                        {lead.title} at {lead.company}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-2">{getStatusBadges(lead)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
