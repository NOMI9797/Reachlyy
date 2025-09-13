"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, MessageSquare, Calendar, Loader2 } from "lucide-react"
import { CreateCampaignModal } from "@/components/create-campaign-modal"

interface Campaign {
  id: string
  name: string
  description?: string
  createdAt: string
  leadsCount: number
  messagesGenerated: number
  status: "draft" | "active" | "paused" | "completed"
}

interface CampaignsListProps {
  onSelectCampaign: (campaign: Campaign) => void
}

export function CampaignsList({ onSelectCampaign }: CampaignsListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch campaigns from API
  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/campaigns')
      const result = await response.json()
      
      if (result.success) {
        // Transform database campaigns to match the interface
        const transformedCampaigns = result.data.map((campaign: any) => ({
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          createdAt: campaign.createdAt,
          leadsCount: parseInt(campaign.leadsCount) || 0, // Use actual lead count from database
          messagesGenerated: 0, // TODO: Calculate from messages table
          status: campaign.status,
        }))
        setCampaigns(transformedCampaigns)
      } else {
        setError(result.message || 'Failed to fetch campaigns')
      }
    } catch (err) {
      setError('Failed to fetch campaigns')
      console.error('Error fetching campaigns:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load campaigns on component mount
  useEffect(() => {
    fetchCampaigns()
  }, [])

  const handleCreateCampaign = async (campaignData: any) => {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignData.name,
          description: campaignData.description,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Transform the new campaign to match the interface
        const newCampaign: Campaign = {
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          createdAt: result.data.createdAt,
          leadsCount: 0,
          messagesGenerated: 0,
          status: result.data.status,
        }
        setCampaigns([newCampaign, ...campaigns])
        setShowCreateModal(false)
        onSelectCampaign(newCampaign)
      } else {
        setError(result.message || 'Failed to create campaign')
      }
    } catch (err) {
      setError('Failed to create campaign')
      console.error('Error creating campaign:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
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

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={fetchCampaigns}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading campaigns...</span>
          </div>
        )}

        {/* Campaigns Grid */}
        {!loading && (
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
        )}

        {/* Empty State */}
        {!loading && campaigns.length === 0 && !error && (
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
