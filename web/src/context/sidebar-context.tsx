import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

type SidebarContextValue = {
  // Search dialog
  searchDialogOpen: boolean
  openSearchDialog: () => void
  closeSearchDialog: () => void
  // Create dialog
  createDialogOpen: boolean
  openCreateDialog: () => void
  closeCreateDialog: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const openSearchDialog = useCallback(() => {
    setSearchDialogOpen(true)
  }, [])

  const closeSearchDialog = useCallback(() => {
    setSearchDialogOpen(false)
  }, [])

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true)
  }, [])

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
  }, [])

  return (
    <SidebarContext.Provider
      value={{
        searchDialogOpen,
        openSearchDialog,
        closeSearchDialog,
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
