import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import "./App.css"

function App() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex items-center gap-2 px-4 py-3">
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            Combo Recorder
          </span>
        </SidebarHeader>
        <SidebarContent />
        <SidebarFooter className="p-2">
          <div className="text-xs text-muted-foreground px-2 group-data-[collapsible=icon]:hidden">
            Settings
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-3 border-b px-4 h-12 shrink-0">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            {/* Action buttons placeholder */}
            <span className="text-xs text-muted-foreground">Toolbar</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <span className="text-muted-foreground text-sm">Main content</span>
        </main>
        <footer className="flex items-center justify-between h-8 px-4 border-t text-xs text-muted-foreground shrink-0">
          <span>Ready</span>
          <span>v0.1.0</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
