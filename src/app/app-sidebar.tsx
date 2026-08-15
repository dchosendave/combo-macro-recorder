import { CircleHelp, FlaskConical, HandFist, Keyboard, Settings, Zap } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from "@/shared/components/ui/sidebar"

type AppSidebarProps = {
  activeTab: "combo" | "profiles" | "settings"
  innerTab: "potions" | "skills"
  onSelectTab: (tab: "combo" | "profiles" | "settings") => void
  onSelectInnerTab: (tab: "potions" | "skills") => void
  onOpenHelp: () => void
}

export function AppSidebar({
  activeTab,
  innerTab,
  onSelectTab,
  onSelectInnerTab,
  onOpenHelp,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span className="px-3 pt-4 pb-2 font-heading text-sm font-semibold group-data-[collapsible=icon]:hidden">
          Hamin Macro Recorder
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "combo"}
                  onClick={() => onSelectTab("combo")}
                  tooltip="Combo"
                >
                  <Zap />
                  <span>Combo</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuItem>
                    <SidebarMenuSubButton
                      isActive={activeTab === "combo" && innerTab === "potions"}
                      onClick={() => onSelectInnerTab("potions")}
                    >
                      <FlaskConical />
                      <span>Potions</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuSubButton
                      isActive={activeTab === "combo" && innerTab === "skills"}
                      onClick={() => onSelectInnerTab("skills")}
                    >
                      <HandFist />
                      <span>Skills</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "profiles"}
                  onClick={() => onSelectTab("profiles")}
                  tooltip="Hotkeys"
                >
                  <Keyboard />
                  <span>Hotkeys</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "settings"}
                  onClick={() => onSelectTab("settings")}
                  tooltip="Settings"
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenHelp} tooltip="Help & getting started">
              <CircleHelp />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
