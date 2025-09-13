"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Heart, MessageCircle, Repeat2, Send, Edit } from "lucide-react"

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

interface LeadDetailsProps {
  lead: Lead | null
}

const mockPosts = [
  {
    id: "1",
    content:
      "Just launched our new AI-powered analytics dashboard! The response from our beta users has been incredible. 🚀 #SaaS #Analytics",
    timestamp: "2 days ago",
    likes: 45,
    comments: 12,
    shares: 8,
  },
  {
    id: "2",
    content:
      "Reflecting on Q4 growth strategies. The key is finding the right balance between acquisition and retention. What's working for your team?",
    timestamp: "5 days ago",
    likes: 23,
    comments: 7,
    shares: 3,
  },
  {
    id: "3",
    content:
      "Excited to speak at the Marketing Innovation Summit next week! Will be sharing insights on data-driven growth strategies.",
    timestamp: "1 week ago",
    likes: 67,
    comments: 15,
    shares: 12,
  },
]

const generatedMessage = `Hi Sarah,

I came across your recent post about launching your AI-powered analytics dashboard - congratulations on the incredible beta response! 🎉

As someone who's clearly passionate about data-driven solutions, I thought you might be interested in how we're helping companies like TechFlow Inc streamline their LinkedIn outreach using similar AI technology.

Would you be open to a brief conversation about how we could potentially help amplify your team's growth efforts?

Best regards,
[Your Name]`

export function LeadDetails({ lead }: LeadDetailsProps) {
  if (!lead) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-muted-foreground text-center">Select a lead to view their details and generated message</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={lead.avatar || "/placeholder.svg"} />
            <AvatarFallback>
              {lead.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{lead.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lead.title} at {lead.company}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <h3 className="font-medium mb-3">Recent Posts</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {mockPosts.map((post) => (
              <div key={post.id} className="p-3 bg-muted rounded-lg">
                <p className="text-sm mb-2">{post.content}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{post.timestamp}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {post.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {post.comments}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-3 w-3" />
                      {post.shares}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Generated Message</h3>
            <Badge variant="secondary">AI Generated</Badge>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <pre className="text-sm whitespace-pre-wrap font-sans">{generatedMessage}</pre>
          </div>

          <div className="flex gap-2 mt-4">
            <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90">
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
            <Button size="sm" variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
