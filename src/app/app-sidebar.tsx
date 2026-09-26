import { CircleHelp, FlaskConical, HandFist, Keyboard, Settings } from "lucide-react"
import { Button } from "@/shared/components/ui/button"

type AppSidebarProps = {
  activeTab: "combo" | "profiles" | "settings"
  innerTab: "potions" | "skills"
  onSelectTab: (tab: "combo" | "profiles" | "settings") => void
  onSelectInnerTab: (tab: "potions" | "skills") => void
  onOpenHelp: () => void
}

export function AppNavigation({
  activeTab,
  innerTab,
  onSelectTab,
  onSelectInnerTab,
  onOpenHelp,
}: AppSidebarProps) {
  const itemClass = "h-8 gap-1.5 px-3 text-xs"

  return (
    <nav className="flex shrink-0 items-center gap-1 border-b px-2 py-1" aria-label="Main navigation">
      <Button className={itemClass} size="sm" variant={activeTab === "combo" && innerTab === "potions" ? "secondary" : "ghost"} onClick={() => onSelectInnerTab("potions")}>
        <FlaskConical className="size-3.5" /> Potions
      </Button>
      <Button className={itemClass} size="sm" variant={activeTab === "combo" && innerTab === "skills" ? "secondary" : "ghost"} onClick={() => onSelectInnerTab("skills")}>
        <HandFist className="size-3.5" /> Skills
      </Button>
      <Button className={itemClass} size="sm" variant={activeTab === "profiles" ? "secondary" : "ghost"} onClick={() => onSelectTab("profiles")}>
        <Keyboard className="size-3.5" /> Hotkeys
      </Button>
      <Button className={itemClass} size="sm" variant={activeTab === "settings" ? "secondary" : "ghost"} onClick={() => onSelectTab("settings")}>
        <Settings className="size-3.5" /> Settings
      </Button>
      <Button className="ml-auto size-8" size="icon" variant="ghost" onClick={onOpenHelp} aria-label="Help and getting started" title="Help and getting started">
        <CircleHelp className="size-4" />
      </Button>
    </nav>
  )
}
