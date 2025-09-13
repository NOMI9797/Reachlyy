"use client"

import { cn } from "@/lib/utils"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Heart, MessageCircle, Repeat2, RefreshCw, Calendar } from "lucide-react"

interface Lead {
  id: string
  url: string
  status: "pending" | "running" | "completed" | "error"
  name?: string
  title?: string
  company?: string
  progress?: number
}

interface Post {
  id: string
  content: string
  timestamp: string
  likes: number
  comments: number
  shares: number
  engagement: number
}

interface LeadPostsProps {
  lead: Lead | null
}

const mockPosts: Post[] = [
  {
    id: "1",
    content:
      "Just launched our new AI-powered analytics dashboard! The response from our beta users has been incredible. 🚀 #SaaS #Analytics",
    timestamp: "2 days ago",
    likes: 45,
    comments: 12,
    shares: 8,
    engagement: 4.2,
  },
  {
    id: "2",
    content:
      "Reflecting on Q4 growth strategies. The key is finding the right balance between acquisition and retention. What's working for your team?",
    timestamp: "5 days ago",
    likes: 23,
    comments: 7,
    shares: 3,
    engagement: 2.8,
  },
  {
    id: "3",
    content:
      "Excited to speak at the Marketing Innovation Summit next week! Will be sharing insights on data-driven growth strategies.",
    timestamp: "1 week ago",
    likes: 67,
    comments: 15,
    shares: 12,
    engagement: 5.1,
  },
  {
    id: "4",
    content:
      "Team collaboration is everything. Our recent project success was 100% due to cross-functional alignment and clear communication.",
    timestamp: "2 weeks ago",
    likes: 34,
    comments: 9,
    shares: 5,
    engagement: 3.2,
  },
  {
    id: "5",
    content:
      "The future of B2B marketing is personalization at scale. AI is making it possible to create meaningful connections with thousands of prospects.",
    timestamp: "3 weeks ago",
    likes: 89,
    comments: 23,
    shares: 18,
    engagement: 6.8,
  },
]

export function LeadPosts({ lead }: { lead: Lead | null }) {
  const [postsToFetch, setPostsToFetch] = useState("10")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [postsFetched, setPostsFetched] = useState(false)

  const handleRefreshPosts = async () => {
    setIsRefreshing(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setPostsFetched(true)
    setIsRefreshing(false)
  }

  if (!lead) {
    return (
      <Card className="h-fit">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select a lead to view their recent posts</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (lead.status === "pending") {
    return (
      <Card className="h-fit">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Run this lead to fetch their posts</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src="/professional-headshot.png" />
            <AvatarFallback>
              {lead.name
                ?.split(" ")
                .map((n) => n[0])
                .join("") || "??"}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{lead.name || "Processing..."}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lead.title && lead.company ? `${lead.title} at ${lead.company}` : "Fetching profile..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={postsToFetch} onValueChange={setPostsToFetch}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 posts</SelectItem>
              <SelectItem value="10">10 posts</SelectItem>
              <SelectItem value="20">20 posts</SelectItem>
              <SelectItem value="50">50 posts</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handleRefreshPosts} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Fetching..." : "Refresh"}
          </Button>

          {postsFetched && (
            <Badge variant="outline" className="ml-auto">
              {mockPosts.length} posts fetched
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {!postsFetched ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Button onClick={handleRefreshPosts} disabled={isRefreshing}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Fetching Posts..." : "Fetch Posts"}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">Click to fetch {postsToFetch} recent posts</p>
            </div>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-4 p-4">
              {mockPosts.slice(0, Number.parseInt(postsToFetch)).map((post) => (
                <div key={post.id} className="p-4 bg-muted/30 rounded-lg border transition-colors hover:bg-muted/50">
                  <p className="text-sm mb-3 leading-relaxed text-balance">{post.content}</p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {post.timestamp}
                    </span>

                    <div className="flex items-center gap-4">
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
                      <Badge variant="secondary" className="text-xs">
                        {post.engagement}% engagement
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
