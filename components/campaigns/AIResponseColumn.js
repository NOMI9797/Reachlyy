"use client";

import { useState, useEffect, memo } from "react";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  Copy,
  Settings,
  Loader2,
  Sparkles,
  Trash2,
  Check,
  RefreshCw,
  MessageSquare,
  Clock,
  User,
} from "lucide-react";

const AIResponseColumn = memo(function AIResponseColumn({
  selectedLead,
  campaignId,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
  aiSettings,
  setAiSettings,
}) {
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const [copiedStates, setCopiedStates] = useState(new Set());

  // Load message history when lead changes
  useEffect(() => {
    if (selectedLead) {
      loadMessageHistory();
    } else {
      setMessageHistory([]);
      setGeneratedMessage("");
    }
  }, [selectedLead]);

  const loadMessageHistory = async () => {
    try {
      const leadId = selectedLead._id || selectedLead.id;
      const response = await fetch(`/api/messages/generate?leadId=${leadId}`);
      const result = await response.json();
      
      if (result.success && result.messages.length > 0) {
        const mappedMessages = result.messages.map(msg => ({
          id: msg.id,
          message: msg.content,
          timestamp: msg.createdAt,
          model: msg.model,
          postsAnalyzed: msg.postsAnalyzed,
          tokensUsed: msg.tokensUsed || 0,
        }));
        
        setMessageHistory(mappedMessages);
        
        // Set the most recent message as the current displayed message
        if (mappedMessages.length > 0) {
          setGeneratedMessage(mappedMessages[0].message);
        }
      } else {
        setMessageHistory([]);
        setGeneratedMessage("");
      }
    } catch (error) {
      console.error("Error loading message history:", error);
    }
  };

  const models = [
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B", description: "Fast and efficient" },
    { value: "llama3-8b-8192", label: "Llama 3 8B", description: "Alternative fast model" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B", description: "Balanced performance" },
    { value: "gemma-7b-it", label: "Gemma 7B", description: "Good for creative tasks" },
  ];

  const generateMessage = async () => {
    if (!selectedLead || !campaignId) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/messages/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: selectedLead._id || selectedLead.id,
          model: aiSettings?.model || "llama-3.1-8b-instant",
          customPrompt: aiSettings?.customPrompt || "",
        }),
      });

      const result = await response.json();

      if (result.success) {
        setGeneratedMessage(result.message.content);
        
        // Add to history
        const newMessage = {
          id: result.message.id,
          message: result.message.content,
          timestamp: result.message.createdAt,
          model: result.message.model,
          postsAnalyzed: result.message.postsAnalyzed,
          tokensUsed: result.message.tokensUsed,
        };
        setMessageHistory(prev => [newMessage, ...prev]);
        toast.success("Message generated successfully!");
      } else {
        throw new Error(result.error || "Failed to generate message");
      }
    } catch (error) {
      console.error("Error generating message:", error);
      setGeneratedMessage("Error: Failed to generate message - " + error.message);
      toast.error(`Failed to generate message: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text, messageId) => {
    const id = messageId || "current";
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopiedStates(prev => new Set(prev).add(id));
        toast.success("Message copied to clipboard!");
        setTimeout(() => {
          setCopiedStates(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }, 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        
        setCopiedStates(prev => new Set(prev).add(id));
        toast.success("Message copied to clipboard!");
        setTimeout(() => {
          setCopiedStates(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to copy text:", err);
      toast.error("Failed to copy text. Please select and copy manually.");
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMessageHistory(prev => prev.filter(msg => msg.id !== messageId));
        if (generatedMessage && messageHistory[0]?.id === messageId) {
          setGeneratedMessage("");
        }
        toast.success("Message deleted successfully!");
      } else {
        console.error("Failed to delete message");
        toast.error("Failed to delete message");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const clearCurrentMessage = () => {
    setGeneratedMessage("");
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
          AI Response
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
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-base-content">AI Message Generator</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {selectedLead && (
          <div className="text-sm text-base-content/60 mb-3">
            Generating for:{" "}
            <span className="text-base-content font-medium">
              {selectedLead.name || "Selected Lead"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!selectedLead ? (
          <div className="text-center text-base-content/60 py-8">
            <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a lead to generate messages</p>
          </div>
        ) : selectedLead.status !== "completed" ? (
          <div className="text-center text-base-content/60 py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50 animate-spin" />
            <p className="text-sm">Wait for lead processing to complete</p>
          </div>
        ) : (
          <>
            {/* Generate Button */}
            <button
              onClick={generateMessage}
              disabled={isGenerating}
              className="btn btn-primary w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Personalized Message
                </>
              )}
            </button>

            {/* Current Generated Message */}
            {generatedMessage && (
              <div className="card bg-base-100 border border-base-300">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="card-title text-sm">Generated Message</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => copyToClipboard(generatedMessage, "current")}
                        className={`btn btn-ghost btn-xs btn-circle ${
                          copiedStates.has("current")
                            ? "text-success bg-success/10"
                            : ""
                        }`}
                        title={copiedStates.has("current") ? "Copied!" : "Copy message"}
                      >
                        {copiedStates.has("current") ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={clearCurrentMessage}
                        className="btn btn-ghost btn-xs btn-circle text-error hover:text-error"
                        title="Delete message"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-base-200 rounded-lg text-sm leading-relaxed">
                    {generatedMessage}
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-base-content/60">
                    <span>
                      Model: {models.find((m) => m.value === aiSettings?.model)?.label || aiSettings?.model || "llama-3.1-8b-instant"}
                    </span>
                    <span>{generatedMessage.length} characters</span>
                  </div>
                </div>
              </div>
            )}

            {/* Message History */}
            {messageHistory.length > 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-base-content">
                    Previous Messages
                  </h3>
                  <div className="badge badge-outline badge-sm">
                    {messageHistory.length - 1}
                  </div>
                </div>

                {messageHistory.slice(1).map((item) => (
                  <div key={item.id} className="card bg-base-200 border border-base-300">
                    <div className="card-body p-3">
                      <div className="text-sm leading-relaxed mb-2">
                        {item.message}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-base-content/60">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(item.timestamp)}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => copyToClipboard(item.message, item.id)}
                            className={`btn btn-ghost btn-xs btn-circle ${
                              copiedStates.has(item.id)
                                ? "text-success bg-success/10"
                                : ""
                            }`}
                            title={copiedStates.has(item.id) ? "Copied!" : "Copy message"}
                          >
                            {copiedStates.has(item.id) ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteMessage(item.id)}
                            className="btn btn-ghost btn-xs btn-circle text-error hover:text-error"
                            title="Delete message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default AIResponseColumn;
