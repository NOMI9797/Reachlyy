"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Heart,
  MessageCircle,
  Repeat2,
  Calendar,
  Loader2,
} from "lucide-react"

interface Post {
  id: string
  content: string
  timestamp: string
  likes: number
  comments: number
  reposts: number
  url: string
}

interface PostsColumnProps {
  selectedLead: any
  collapsed: boolean
  onToggleCollapse: () => void
}

export function PostsColumn({ selectedLead, collapsed, onToggleCollapse }: PostsColumnProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  // Mock posts data
  const mockPosts: Post[] = [
    {
      id: "1",
      content:
        "Just shipped a new feature that reduces API response time by 40%! Sometimes the smallest optimizations make the biggest difference. #webdev #performance",
      timestamp: "2024-01-15T10:30:00Z",
      likes: 24,
      comments: 8,
      reposts: 3,
      url: "https://linkedin.com/posts/johndoe_post1",
    },
    {
      id: "2",
      content:
        "Reflecting on 2023: Built 3 major products, mentored 5 junior developers, and learned that the best code is often the code you don't write. What were your biggest learnings this year?",
      timestamp: "2024-01-10T14:20:00Z",
      likes: 156,
      comments: 42,
      reposts: 18,
      url: "https://linkedin.com/posts/johndoe_post2",
    },
    {
      id: "3",
      content:
        "Hot take: Documentation is not just for other developers - it's for future you. I just spent 2 hours figuring out code I wrote 6 months ago because I skipped the docs. Never again! 📝",
      timestamp: "2024-01-08T09:15:00Z",
      likes: 89,
      comments: 23,
      reposts: 12,
      url: "https://linkedin.com/posts/johndoe_post3",
    },
  ]

  const fetchPosts = async () => {
    if (!selectedLead) return

    setIsLoading(true)
    
    try {
      // First try to fetch posts from database
      const response = await fetch(`/api/leads/${selectedLead.id}/posts`)
      const result = await response.json()
      
      if (result.success && result.data.length > 0) {
        // Transform database posts to match Post interface
        const transformedPosts: Post[] = result.data.map((post: any) => ({
          id: post.id,
          content: post.content,
          timestamp: post.timestamp,
          likes: post.likes || 0,
          comments: post.comments || 0,
          reposts: post.shares || 0,
          url: selectedLead.url
        }))
        
        setPosts(transformedPosts)
      } else if (selectedLead.posts && selectedLead.posts.length > 0) {
        // Fallback to posts stored in lead object (for backward compatibility)
        const transformedPosts: Post[] = selectedLead.posts.map((item: any, index: number) => ({
          id: item.id || `post-${index}`,
          content: item.content || item.text || item.description || "No content available",
          timestamp: item.timestamp || item.date || item.createdAt || new Date().toISOString(),
          likes: item.numLikes || item.likes || item.likeCount || 0,
          comments: item.numComments || item.comments || item.commentCount || 0,
          reposts: item.numShares || item.reposts || item.repostCount || item.shares || 0,
          url: item.url || item.link || selectedLead.url
        }))
        
        setPosts(transformedPosts)
      } else {
        // Fallback to mock data if no posts found anywhere
        setPosts(mockPosts)
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
      // Fallback to lead posts or mock data on error
      if (selectedLead.posts && selectedLead.posts.length > 0) {
        const transformedPosts: Post[] = selectedLead.posts.map((item: any, index: number) => ({
          id: item.id || `post-${index}`,
          content: item.content || item.text || item.description || "No content available",
          timestamp: item.timestamp || item.date || item.createdAt || new Date().toISOString(),
          likes: item.numLikes || item.likes || item.likeCount || 0,
          comments: item.numComments || item.comments || item.commentCount || 0,
          reposts: item.numShares || item.reposts || item.repostCount || item.shares || 0,
          url: item.url || item.link || selectedLead.url
        }))
        setPosts(transformedPosts)
      } else {
        setPosts(mockPosts)
      }
    }
    
    setLastFetched(new Date().toISOString())
    setIsLoading(false)
  }

  useEffect(() => {
    if (selectedLead && selectedLead.status === "completed") {
      // Auto-load posts when lead is completed
      if (selectedLead.posts && selectedLead.posts.length > 0) {
        // Transform scraped data to match Post interface
        const transformedPosts: Post[] = selectedLead.posts.map((item: any, index: number) => ({
          id: item.id || `post-${index}`,
          content: item.content || item.text || item.description || "No content available",
          timestamp: item.timestamp || item.date || item.createdAt || new Date().toISOString(),
          likes: item.numLikes || item.likes || item.likeCount || 0,
          comments: item.numComments || item.comments || item.commentCount || 0,
          reposts: item.numShares || item.reposts || item.repostCount || item.shares || 0,
          url: item.url || item.link || selectedLead.url
        }))
        
        setPosts(transformedPosts)
        setLastFetched(new Date().toISOString())
      } else {
        // No scraped posts, show empty state
        setPosts([])
        setLastFetched(null)
      }
    } else {
      setPosts([])
      setLastFetched(null)
    }
  }, [selectedLead])

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d ago`
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 bg-background">
        <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="mb-4 p-2">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="writing-mode-vertical text-sm text-muted-foreground">Posts</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">Recent Posts</h2>
            {posts.length > 0 && <Badge variant="secondary">{posts.length}</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="p-1">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {selectedLead && (
          <div className="text-sm text-muted-foreground">{selectedLead.name || "Selected Lead"}</div>
        )}

        {lastFetched && (
          <div className="text-xs text-muted-foreground mt-2">Last updated: {formatTimestamp(lastFetched)}</div>
        )}
      </div>

      {/* Posts Content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedLead ? (
          <div className="p-4 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a lead to view posts</p>
          </div>
        ) : selectedLead.status !== "completed" ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
            <p className="text-sm">Processing lead...</p>
            <p className="text-xs">Posts will appear once processing is complete</p>
          </div>
        ) : isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Fetching posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No posts found</p>
            <p className="text-xs">This lead may not have recent public posts</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatTimestamp(post.timestamp)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto"
                      onClick={() => window.open(post.url, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-foreground leading-relaxed mb-4">{post.content}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatNumber(post.likes)}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatNumber(post.comments)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat2 className="h-3 w-3" />
                      {formatNumber(post.reposts)}
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
