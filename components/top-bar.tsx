"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bell, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function TopBar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    console.log("[v0] Switching theme from", theme, "to", newTheme)
    setTheme(newTheme)
  }

  if (!mounted) {
    return (
      <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Reachly</h1>
            <div className="flex items-center gap-4 mt-1">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Ready
              </Badge>
              <span className="text-sm text-muted-foreground">Dashboard loaded</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-9 h-9" /> {/* Placeholder for theme toggle */}
          <Button variant="ghost" size="sm">
            <Bell className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarImage src="/professional-headshot.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
        </div>
      </header>
    )
  }

  return (
    <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reachly</h1>
          <div className="flex items-center gap-4 mt-1">
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              Ready
            </Badge>
            <span className="text-sm text-muted-foreground">Dashboard loaded</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleThemeToggle} className="relative">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button variant="ghost" size="sm">
          <Bell className="h-4 w-4" />
        </Button>

        <Avatar className="h-8 w-8">
          <AvatarImage src="/professional-headshot.png" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
