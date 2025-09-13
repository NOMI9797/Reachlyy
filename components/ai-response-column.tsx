"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ChevronLeft, ChevronRight, Wand2, Copy, RefreshCw, Settings, Loader2, Sparkles } from "lucide-react"

interface AIResponseColumnProps {
  selectedLead: any
  collapsed: boolean
  onToggleCollapse: () => void
}

export function AIResponseColumn({ selectedLead, collapsed, onToggleCollapse }: AIResponseColumnProps) {
  const [selectedModel, setSelectedModel] = useState("gpt-4")
  const [postsToUse, setPostsToUse] = useState([3])
  const [customPrompt, setCustomPrompt] = useState("")
  const [generatedMessage, setGeneratedMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [messageHistory, setMessageHistory] = useState<Array<{ id: string; message: string; timestamp: string }>>([])

  const models = [
    { value: "gpt-4", label: "GPT-4", description: "Most capable, best for complex tasks" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Fast and efficient" },
    { value: "claude-3", label: "Claude 3", description: "Great for creative writing" },
    { value: "gemini-pro", label: "Gemini Pro", description: "Google's latest model" },
  ]

  const generateMessage = async () => {
    if (!selectedLead) return

    setIsGenerating(true)

    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const mockMessages = [
      `Hi ${selectedLead.name || "there"}! I noticed your recent post about API optimization - reducing response time by 40% is impressive! I've been working on similar performance improvements and would love to connect and share insights about scalable architecture patterns.`,

      `Hello ${selectedLead.name || "there"}! Your reflection on 2023 resonated with me, especially the point about mentoring junior developers. I'm also passionate about knowledge sharing and would be interested in discussing best practices for technical mentorship.`,

      `Hi ${selectedLead.name || "there"}! Completely agree with your take on documentation - future you will definitely thank present you! I've implemented some interesting documentation strategies that have saved countless hours. Would love to connect and exchange ideas.`,
    ]

    const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)]
    setGeneratedMessage(randomMessage)

    // Add to history
    const newMessage = {
      id: Date.now().toString(),
      message: randomMessage,
      timestamp: new Date().toISOString(),
    }
    setMessageHistory((prev) => [newMessage, ...prev])

    setIsGenerating(false)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add a toast notification here
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 bg-background">
        <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="mb-4 p-2">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="writing-mode-vertical text-sm text-muted-foreground">AI Response</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">AI Message Generator</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="p-1">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="p-1">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {selectedLead && (
          <div className="text-sm text-muted-foreground mb-3">
            Generating for: <span className="text-foreground font-medium">{selectedLead.name || "Selected Lead"}</span>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-border bg-muted/30 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model-select">AI Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div>
                      <div className="font-medium">{model.label}</div>
                      <div className="text-xs text-muted-foreground">{model.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Posts to analyze: {postsToUse[0]}</Label>
            <Slider value={postsToUse} onValueChange={setPostsToUse} max={5} min={1} step={1} className="w-full" />
            <div className="text-xs text-muted-foreground">Use the {postsToUse[0]} most recent posts for context</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-prompt">Custom Instructions (Optional)</Label>
            <Textarea
              id="custom-prompt"
              placeholder="Add specific instructions for the AI (e.g., tone, length, focus areas)..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!selectedLead ? (
          <div className="text-center text-muted-foreground py-8">
            <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a lead to generate messages</p>
          </div>
        ) : selectedLead.status !== "completed" ? (
          <div className="text-center text-muted-foreground py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
            <p className="text-sm">Wait for lead processing to complete</p>
          </div>
        ) : (
          <>
            {/* Generate Button */}
            <Button onClick={generateMessage} disabled={isGenerating} className="w-full gap-2" size="lg">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {isGenerating ? "Generating..." : "Generate Personalized Message"}
            </Button>

            {/* Current Generated Message */}
            {generatedMessage && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Generated Message</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(generatedMessage)}
                        className="p-1"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={generateMessage} className="p-1">
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="p-3 bg-muted/50 rounded-md text-sm leading-relaxed">{generatedMessage}</div>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>Model: {models.find((m) => m.value === selectedModel)?.label}</span>
                    <span>{generatedMessage.length} characters</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Message History */}
            {messageHistory.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">Previous Messages</h3>
                  <Badge variant="secondary">{messageHistory.length}</Badge>
                </div>

                {messageHistory.map((item) => (
                  <Card key={item.id} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="text-sm leading-relaxed mb-2">{item.message}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(item.message)} className="p-1">
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
