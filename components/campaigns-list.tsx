"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, MessageSquare, Calendar } from "lucide-react"
import { CreateCampaignModal } from "@/components/create-campaign-modal"

interface Campaign {
  id: string
  name: string
  description?: string
  createdAt: string
  leadsCount: number
  messagesGenerated: number
  status: "active" | "paused" | "completed"
}

interface CampaignsListProps {
  onSelectCampaign: (campaign: Campaign) => void
}

export function CampaignsList({ onSelectCampaign }: CampaignsListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "Tech Startup Outreach",
      description: "Targeting startup founders and CTOs",
      createdAt: "2024-01-15",
      leadsCount: 247,
      messagesGenerated: 89,
      status: "active",
    },
    {
      id: "2",
      name: "SaaS Decision Makers",
      description: "B2B SaaS company executives",
      createdAt: "2024-01-10",
      leadsCount: 156,
      messagesGenerated: 156,
      status: "completed",
    },
  ])

  const handleCreateCampaign = (campaignData: any) => {
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: campaignData.name,
      description: campaignData.description,
      createdAt: new Date().toISOString().split("T")[0],
      leadsCount: 0,
      messagesGenerated: 0,
      status: "active",
    }
    setCampaigns([newCampaign, ...campaigns])
    setShowCreateModal(false)
    onSelectCampaign(newCampaign)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      case "paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    }
  }

  return (
    <div className="p-6 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Manage your outreach campaigns</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </div>

        {/* Campaigns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border bg-card"
              onClick={() => onSelectCampaign(campaign)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-card-foreground">{campaign.name}</CardTitle>
                    {campaign.description && (
                      <CardDescription className="text-sm">{campaign.description}</CardDescription>
                    )}
                  </div>
                  <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{campaign.leadsCount} leads</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{campaign.messagesGenerated} messages</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">Create your first outreach campaign to get started</p>
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </div>
        )}
      </div>

      <CreateCampaignModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateCampaign}
      />
    </div>
  )
}
