"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"

export function CampaignSetup() {
  const [keywords, setKeywords] = useState<string[]>(["SaaS", "Marketing", "Growth"])
  const [roles, setRoles] = useState<string[]>(["CEO", "Marketing Director"])
  const [industries, setIndustries] = useState<string[]>(["Technology", "Software"])

  const addTag = (value: string, setter: (tags: string[]) => void, current: string[]) => {
    if (value.trim() && !current.includes(value.trim())) {
      setter([...current, value.trim()])
    }
  }

  const removeTag = (tag: string, setter: (tags: string[]) => void, current: string[]) => {
    setter(current.filter((t) => t !== tag))
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Campaign Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="campaign-name">Campaign Name</Label>
          <Input id="campaign-name" placeholder="Q1 2024 Outreach" className="mt-1" />
        </div>

        <div>
          <Label>Keywords</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="gap-1">
                {keyword}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(keyword, setKeywords, keywords)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add keyword"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  addTag(e.currentTarget.value, setKeywords, keywords)
                  e.currentTarget.value = ""
                }
              }}
            />
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label>Target Roles</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {roles.map((role) => (
              <Badge key={role} variant="secondary" className="gap-1">
                {role}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(role, setRoles, roles)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add role"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  addTag(e.currentTarget.value, setRoles, roles)
                  e.currentTarget.value = ""
                }
              }}
            />
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label>Industries</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {industries.map((industry) => (
              <Badge key={industry} variant="secondary" className="gap-1">
                {industry}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(industry, setIndustries, industries)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add industry"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  addTag(e.currentTarget.value, setIndustries, industries)
                  e.currentTarget.value = ""
                }
              }}
            />
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="message-template">Message Template</Label>
          <Textarea
            id="message-template"
            placeholder="Hi {firstName}, I noticed your recent post about {topic}..."
            className="mt-1 min-h-[100px]"
          />
        </div>

        <Button className="w-full bg-primary hover:bg-primary/90">Start Lead Discovery</Button>
      </CardContent>
    </Card>
  )
}
