"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Send, Edit, RefreshCw, Sparkles, Copy, MessageSquare } from "lucide-react"
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

interface MessageGeneratorProps {
  lead: Lead | null
}

export function MessageGenerator({ lead }: MessageGeneratorProps) {
  const [selectedModel, setSelectedModel] = useState("gpt-4")
  const [postsToAnalyze, setPostsToAnalyze] = useState([3])
  const [message, setMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [messageGenerated, setMessageGenerated] = useState(false)

  const handleGenerateMessage = async () => {
    if (lead?.status !== "completed") return

    setIsGenerating(true)
    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const generatedMessage = `Hi ${lead.name || "there"},

I came across your recent post about launching your AI-powered analytics dashboard - congratulations on the incredible beta response! 🎉

As someone who's clearly passionate about data-driven solutions, I thought you might be interested in how we're helping companies like ${lead.company || "TechFlow Inc"} streamline their LinkedIn outreach using similar AI technology.

Would you be open to a brief conversation about how we could potentially help amplify your team's growth efforts?

Best regards,
[Your Name]`

    setMessage(generatedMessage)
    setMessageGenerated(true)
    setIsGenerating(false)
  }

  const handleSendMessage = async () => {
    setIsSending(true)
    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsSending(false)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message)
  }

  if (!lead) {
    return (
      <Card className="h-fit">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select a lead to generate personalized messages</p>
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
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Run this lead to generate messages</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Message Generator</CardTitle>
          {messageGenerated && (
            <Badge variant="secondary">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">AI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4 (Premium)</SelectItem>
                  <SelectItem value="gpt-3.5">GPT-3.5 (Fast)</SelectItem>
                  <SelectItem value="claude">Claude (Creative)</SelectItem>
                  <SelectItem value="gemini">Gemini (Analytical)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Posts to Analyze</Label>
              <div className="pt-2">
                <Slider
                  value={postsToAnalyze}
                  onValueChange={setPostsToAnalyze}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1</span>
                  <span>{postsToAnalyze[0]} posts</span>
                  <span>10</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerateMessage}
            disabled={lead.status !== "completed" || isGenerating}
            className="w-full"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
            {isGenerating ? "Generating..." : "Generate Message"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Personalized Message</Label>
            <Button variant="ghost" size="sm" onClick={copyToClipboard} disabled={!message}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[300px] resize-none"
            placeholder={
              lead.status !== "completed"
                ? "Process this lead first to generate a personalized message"
                : "Generate a message using AI or write your own"
            }
            disabled={lead.status !== "completed"}
          />
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button onClick={handleSendMessage} disabled={!message.trim() || isSending} className="flex-1">
            <Send className={cn("h-4 w-4 mr-2", isSending && "animate-pulse")} />
            {isSending ? "Sending..." : "Send Message"}
          </Button>

          <Button variant="outline" size="icon" disabled={!message}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{message.length} characters</span>
          <span>{message.split("\n\n").length} paragraphs</span>
        </div>
      </CardContent>
    </Card>
  )
}
