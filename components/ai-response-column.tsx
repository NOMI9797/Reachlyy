"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Wand2, Copy, RefreshCw, Settings, Loader2, Sparkles, Trash2, Check } from "lucide-react"

interface AIResponseColumnProps {
  selectedLead: any
  campaignId?: string
  collapsed: boolean
  onToggleCollapse: () => void
}

export function AIResponseColumn({ selectedLead, campaignId, collapsed, onToggleCollapse }: AIResponseColumnProps) {
  const [selectedModel, setSelectedModel] = useState("llama-3.1-8b-instant")
  const [customPrompt, setCustomPrompt] = useState("")
  const [generatedMessage, setGeneratedMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [messageHistory, setMessageHistory] = useState<Array<{ id: string; message: string; timestamp: string }>>([])
  const [copiedStates, setCopiedStates] = useState<Set<string>>(new Set())

  const models = [
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B", description: "Fast and efficient" },
    { value: "llama3-8b-8192", label: "Llama 3 8B", description: "Alternative fast model" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B", description: "Balanced performance" },
    { value: "gemma-7b-it", label: "Gemma 7B", description: "Good for creative tasks" },
  ]

  const loadMessageHistory = useCallback(async () => {
    if (!selectedLead?.id || !campaignId) return
    
    try {
      const response = await fetch(`/api/messages/generate?leadId=${selectedLead.id}&campaignId=${campaignId}`)
      const result = await response.json()
      
      if (result.success) {
        if (result.data.length > 0) {
          // Load the most recent message
          const latestMessage = result.data[0]
          setGeneratedMessage(latestMessage.content)
          
          // Load message history
          const history = result.data.slice(0, 5).map((msg: any) => ({
            id: msg.id,
            message: msg.content,
            timestamp: new Date(msg.createdAt).toISOString(),
          }))
          setMessageHistory(history)
        } else {
          // No messages for this lead
          setGeneratedMessage("")
          setMessageHistory([])
        }
      } else {
        setGeneratedMessage("")
        setMessageHistory([])
      }
    } catch (error) {
      console.error('Error loading message history:', error)
      setGeneratedMessage("")
      setMessageHistory([])
    }
  }, [selectedLead?.id, campaignId])

  // Load message history when lead changes
  useEffect(() => {
    // Clear previous messages immediately when lead changes
    setMessageHistory([])
    setGeneratedMessage("")
    setCopiedStates(new Set())
    
    if (selectedLead?.id && campaignId) {
      loadMessageHistory()
    }
  }, [selectedLead?.id, campaignId, loadMessageHistory])

  const generateMessage = async () => {
    if (!selectedLead || !campaignId) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/messages/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          campaignId,
          model: selectedModel,
          customPrompt,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const message = result.data.content
        setGeneratedMessage(message)
        
        // Add to history but don't duplicate the current message
        const newMessage = {
          id: result.data.message.id,
          message,
          timestamp: new Date().toISOString(),
        }
        // Only add to history, don't show in both places
        setMessageHistory((prev) => [newMessage, ...prev])
      } else {
        // Show error message
        setGeneratedMessage(`Error: ${result.message || 'Failed to generate message'}`)
      }
    } catch (error) {
      console.error('Error generating message:', error)
      setGeneratedMessage('Error: Failed to connect to message generation service')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, messageId?: string) => {
    const id = messageId || 'current'
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        console.log('Text copied to clipboard successfully')
        
        // Show visual feedback
        setCopiedStates(prev => new Set(prev).add(id))
        setTimeout(() => {
          setCopiedStates(prev => {
            const newSet = new Set(prev)
            newSet.delete(id)
            return newSet
          })
        }, 2000)
        return
      }
      
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        document.execCommand('copy')
        console.log('Text copied to clipboard using fallback method')
        
        // Show visual feedback
        setCopiedStates(prev => new Set(prev).add(id))
        setTimeout(() => {
          setCopiedStates(prev => {
            const newSet = new Set(prev)
            newSet.delete(id)
            return newSet
          })
        }, 2000)
      } catch (err) {
        console.error('Fallback copy failed:', err)
        alert('Failed to copy text. Please select and copy manually.')
      } finally {
        document.body.removeChild(textArea)
      }
    } catch (err) {
      console.error("Failed to copy text: ", err)
      alert('Failed to copy text. Please select and copy manually.')
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        // Check if we're deleting the current message (first in history)
        const isCurrentMessage = messageHistory.length > 0 && messageHistory[0].id === messageId
        
        // Remove from message history
        setMessageHistory(prev => prev.filter(msg => msg.id !== messageId))
        
        // If this was the current message, clear it and potentially show the next one
        if (isCurrentMessage) {
          const remainingMessages = messageHistory.filter(msg => msg.id !== messageId)
          if (remainingMessages.length > 0) {
            // Show the next most recent message as current
            setGeneratedMessage(remainingMessages[0].message)
          } else {
            // No more messages, clear current
            setGeneratedMessage("")
          }
        }
      } else {
        console.error('Failed to delete message:', result.message)
      }
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }

  const clearCurrentMessage = () => {
    setGeneratedMessage("")
    // If there are previous messages, we might want to show the next most recent one
    // For now, just clear the current message display
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
                        onClick={() => copyToClipboard(generatedMessage, 'current')}
                        className={`p-1 transition-all duration-200 ${
                          copiedStates.has('current') 
                            ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' 
                            : ''
                        }`}
                        title={copiedStates.has('current') ? "Copied!" : "Copy message"}
                      >
                        {copiedStates.has('current') ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearCurrentMessage} 
                        className="p-1 text-destructive hover:text-destructive"
                        title="Delete message"
                      >
                        <Trash2 className="h-3 w-3" />
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
            {messageHistory.length > 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">Previous Messages</h3>
                  <Badge variant="secondary">{messageHistory.length - 1}</Badge>
                </div>

                {messageHistory.slice(1).map((item) => (
                  <Card key={item.id} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="text-sm leading-relaxed mb-2">{item.message}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => copyToClipboard(item.message, item.id)} 
                            className={`p-1 transition-all duration-200 ${
                              copiedStates.has(item.id) 
                                ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' 
                                : ''
                            }`}
                            title={copiedStates.has(item.id) ? "Copied!" : "Copy message"}
                          >
                            {copiedStates.has(item.id) ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteMessage(item.id)} 
                            className="p-1 text-destructive hover:text-destructive"
                            title="Delete message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
