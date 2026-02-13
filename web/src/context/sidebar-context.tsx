import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

type SidebarContextValue = {
  // Create dialog
  createDialogOpen: boolean
  openCreateDialog: () => void
  closeCreateDialog: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true)
  }, [])

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
  }, [])

  return (
    <SidebarContext.Provider
      value={{
        createDialogOpen,
        openCreateDialog,
        closeCreateDialog,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider')
  }
  return context
}
