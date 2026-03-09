import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore, isInShell } from '@mochi/common'
import { RepositoriesLayout } from '@/components/layout/repositories-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const store = useAuthStore.getState()

    if (!store.isInitialized) {
      if (isInShell()) {
        await store.initializeFromShell()
      } else {
        store.initialize()
      }
    }
  },
  component: RepositoriesLayout,
})
