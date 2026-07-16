// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

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
