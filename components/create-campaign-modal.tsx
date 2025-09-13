"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Link, Loader2 } from "lucide-react"

interface CreateCampaignModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => void
}

export function CreateCampaignModal({ open, onClose, onSubmit }: CreateCampaignModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    searchUrl: "",
    csvFile: null as File | null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("url")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    onSubmit(formData)
    setIsSubmitting(false)

    // Reset form
    setFormData({
      name: "",
      description: "",
      searchUrl: "",
      csvFile: null,
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/csv") {
      setFormData((prev) => ({ ...prev, csvFile: file }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Set up a new outreach campaign with leads from a search URL or CSV file.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              placeholder="e.g., Tech Startup Outreach"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of your campaign goals..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Lead Source</Label>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="gap-2">
                  <Link className="h-4 w-4" />
                  LinkedIn URL
                </TabsTrigger>
                <TabsTrigger value="csv" className="gap-2">
                  <Upload className="h-4 w-4" />
                  CSV File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-2">
                <Input
                  placeholder="https://www.linkedin.com/search/results/people/..."
                  value={formData.searchUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, searchUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Paste a LinkedIn search results URL to import leads</p>
              </TabsContent>

              <TabsContent value="csv" className="space-y-2">
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {formData.csvFile ? formData.csvFile.name : "Click to upload CSV file"}
                    </p>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  CSV should contain LinkedIn profile URLs in the first column
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
