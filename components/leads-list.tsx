"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle, Clock, Send } from "lucide-react"
import { cn } from "@/lib/utils"

interface Lead {
  id: string
  name: string
  title: string
  company: string
  avatar: string
  status: "fetched" | "posts-collected" | "message-generated" | "message-sent"
  progress: number
  lastActivity: string
}

const mockLeads: Lead[] = [
  {
    id: "1",
    name: "Sarah Chen",
    title: "VP of Marketing",
    company: "TechFlow Inc",
    avatar: "/professional-woman-diverse.png",
    status: "message-sent",
    progress: 100,
    lastActivity: "2 hours ago",
  },
  {
    id: "2",
    name: "Michael Rodriguez",
    title: "CEO",
    company: "StartupX",
    avatar: "/professional-man.png",
    status: "message-generated",
    progress: 75,
    lastActivity: "5 minutes ago",
  },
  {
    id: "3",
    name: "Emily Johnson",
    title: "Growth Director",
    company: "ScaleUp Co",
    avatar: "/professional-blonde-woman.png",
    status: "posts-collected",
    progress: 50,
    lastActivity: "1 minute ago",
  },
  {
    id: "4",
    name: "David Kim",
    title: "Marketing Manager",
    company: "InnovateLab",
    avatar: "/professional-asian-man.png",
    status: "fetched",
    progress: 25,
    lastActivity: "Just now",
  },
]

interface LeadsListProps {
  onSelectLead: (lead: Lead) => void
  selectedLead: Lead | null
}

export function LeadsList({ onSelectLead, selectedLead }: LeadsListProps) {
  const getStatusIcon = (status: Lead["status"]) => {
    switch (status) {
      case "fetched":
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case "posts-collected":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />
      case "message-generated":
        return <CheckCircle className="h-4 w-4 text-primary" />
      case "message-sent":
        return <Send className="h-4 w-4 text-green-600" />
    }
  }

  const getStatusText = (status: Lead["status"]) => {
    switch (status) {
      case "fetched":
        return "Profile Fetched"
      case "posts-collected":
        return "Collecting Posts"
      case "message-generated":
        return "Message Ready"
      case "message-sent":
        return "Message Sent"
    }
  }

  const getStatusColor = (status: Lead["status"]) => {
    switch (status) {
      case "fetched":
        return "secondary"
      case "posts-collected":
        return "default"
      case "message-generated":
        return "default"
      case "message-sent":
        return "default"
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          Found Leads
          <Badge variant="outline">{mockLeads.length} leads</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
          {mockLeads.map((lead) => (
            <div
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className={cn(
                "p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                selectedLead?.id === lead.id && "bg-muted",
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
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
                    <span className="text-xs text-muted-foreground">{lead.lastActivity}</span>
                  </div>

                  <p className="text-sm text-muted-foreground truncate">
                    {lead.title} at {lead.company}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={getStatusColor(lead.status)} className="text-xs">
                      <span className="flex items-center gap-1">
                        {getStatusIcon(lead.status)}
                        {getStatusText(lead.status)}
                      </span>
                    </Badge>
                  </div>

                  <div className="mt-2">
                    <Progress value={lead.progress} className="h-1" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
