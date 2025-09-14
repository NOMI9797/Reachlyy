"use client";

import { useState, useEffect, memo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  MessageCircle,
  Repeat2,
  Calendar,
  Loader2,
  TrendingUp,
  Eye,
} from "lucide-react";

const PostsColumn = memo(function PostsColumn({ selectedLead, collapsed, onToggleCollapse, onOpenSettings }) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  // Mock posts data for demonstration
  const mockPosts = [
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
  ];

  const fetchPosts = async () => {
    if (!selectedLead?._id && !selectedLead?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/leads/${selectedLead._id || selectedLead.id}/posts`);
      const result = await response.json();
      
      if (result.success) {
        setPosts(result.posts);
        setLastFetched(new Date().toISOString());
      } else {
        // Fallback to mock data if API fails
        setPosts(mockPosts);
        setLastFetched(new Date().toISOString());
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      // Fallback to mock data on error
      setPosts(mockPosts);
      setLastFetched(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLead && selectedLead.status === "completed") {
      fetchPosts();
    } else {
      setPosts([]);
      setLastFetched(null);
    }
  }, [selectedLead]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const formatNumber = (num) => {
    // Handle undefined, null, or non-numeric values
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    
    const numValue = Number(num);
    if (numValue >= 1000) {
      return `${(numValue / 1000).toFixed(1)}k`;
    }
    return numValue.toString();
  };

  const calculateEngagement = (likes, comments, reposts) => {
    const likesNum = Number(likes) || 0;
    const commentsNum = Number(comments) || 0;
    const repostsNum = Number(reposts) || 0;
    return likesNum + (commentsNum * 2) + (repostsNum * 3);
  };

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 bg-base-100">
        <button
          onClick={onToggleCollapse}
          className="btn btn-ghost btn-sm btn-circle mb-4"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="writing-mode-vertical text-sm text-base-content/60">
          Posts
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-base-100">
      {/* Header */}
      <div className="p-4 border-b border-base-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base-content">Recent Posts</h2>
            {posts.length > 0 && (
              <div className="badge badge-primary badge-sm">{posts.length}</div>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {selectedLead && (
          <div className="text-sm text-base-content/60 mb-2">
            {selectedLead.name || "Selected Lead"}
          </div>
        )}

        {lastFetched && (
          <div className="text-xs text-base-content/40">
            Last updated: {formatTimestamp(lastFetched)}
          </div>
        )}
      </div>

      {/* Posts Content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedLead ? (
          <div className="p-4 text-center text-base-content/60">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a lead to view posts</p>
          </div>
        ) : selectedLead.status !== "completed" ? (
          <div className="p-4 text-center text-base-content/60">
            <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
            <p className="text-sm">Processing lead...</p>
            <p className="text-xs">Posts will appear once processing is complete</p>
          </div>
        ) : isLoading ? (
          <div className="p-4 text-center text-base-content/60">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Fetching posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-4 text-center text-base-content/60">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No posts found</p>
            <p className="text-xs">This lead may not have recent public posts</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="card bg-base-100 border border-base-300 hover:shadow-sm transition-shadow"
              >
                <div className="card-body p-4">
                  {/* Post Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-base-content/60">
                      <Calendar className="h-3 w-3" />
                      {formatTimestamp(post.timestamp)}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="badge badge-outline badge-sm gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {formatNumber(calculateEngagement(post.likes, post.comments, post.reposts))}
                      </div>
                      <button
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => window.open(post.url, "_blank")}
                        title="View on LinkedIn"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Post Content */}
                  <p className="text-sm text-base-content leading-relaxed mb-4">
                    {post.content}
                  </p>

                  {/* Engagement Metrics */}
                  <div className="flex items-center gap-4 text-xs text-base-content/60">
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
                    <div className="flex items-center gap-1 ml-auto">
                      <Eye className="h-3 w-3" />
                      <span>High engagement</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default PostsColumn;
