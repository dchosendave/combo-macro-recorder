import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/shared/components/ui/tooltip"
import { SidebarProvider } from "@/shared/components/ui/sidebar"
import { AppHeader } from "@/app/app-header"
import type { ComboFileEntry } from "@/combo-file/use-combo-files"

function renderHeader(comboFiles: ComboFileEntry[], onSelect: (p: string) => void) {
  return render(
    <ThemeProvider attribute="class">
      <TooltipProvider>
        <SidebarProvider>
          <AppHeader
            running={false}
            elapsed={0}
            fileName="C:\\combos\\a.json"
            isDirty={false}
            isProcessing={false}
            canRun
            compactMode={false}
            onToggleRunning={vi.fn()}
            onReset={vi.fn()}
            onOpen={vi.fn()}
            onNew={vi.fn()}
            onSave={vi.fn()}
            onSaveAs={vi.fn()}
            recentFiles={[]}
            onOpenRecent={vi.fn()}
            onClearRecent={vi.fn()}
            comboFiles={comboFiles}
            onRequestComboFiles={vi.fn()}
            onSelectComboFile={onSelect}
          />
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe("combo file dropdown", () => {
  it("opens with an empty list without crashing", () => {
    renderHeader([], vi.fn())
    fireEvent.click(screen.getByRole("button", { name: "Switch combo file" }))
    expect(screen.getByText("No combo files found")).toBeTruthy()
  })

  it("renders the file list and selects one", () => {
    const onSelect = vi.fn()
    renderHeader(
      [
        { name: "a.json", path: "C:\\combos\\a.json" },
        { name: "b.json", path: "C:\\combos\\b.json" },
      ],
      onSelect,
    )
    fireEvent.click(screen.getByRole("button", { name: "Switch combo file" }))
    fireEvent.click(screen.getByText("b.json"))
    expect(onSelect).toHaveBeenCalledWith("C:\\combos\\b.json")
  })

  it("survives a list swap while the menu is open (refresh path)", () => {
    const { rerender } = renderHeader([], vi.fn())
    fireEvent.click(screen.getByRole("button", { name: "Switch combo file" }))
    expect(screen.getByText("No combo files found")).toBeTruthy()

    // Simulate onRequestComboFiles resolving: App re-renders AppHeader with files.
    act(() => {
      rerender(
        <ThemeProvider attribute="class">
          <TooltipProvider>
            <SidebarProvider>
              <AppHeader
                running={false}
                elapsed={0}
                fileName="C:\\combos\\a.json"
                isDirty={false}
                isProcessing={false}
                canRun
                compactMode={false}
                onToggleRunning={vi.fn()}
                onReset={vi.fn()}
                onOpen={vi.fn()}
                onNew={vi.fn()}
                onSave={vi.fn()}
                onSaveAs={vi.fn()}
                recentFiles={[]}
                onOpenRecent={vi.fn()}
                onClearRecent={vi.fn()}
                comboFiles={[
                  { name: "a.json", path: "C:\\combos\\a.json" },
                  { name: "b.json", path: "C:\\combos\\b.json" },
                ]}
                onRequestComboFiles={vi.fn()}
                onSelectComboFile={vi.fn()}
              />
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>,
      )
    })

    expect(screen.getByText("b.json")).toBeTruthy()
    expect(screen.queryByText("No combo files found")).toBeNull()
  })
})
