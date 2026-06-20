// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { t } from '@lingui/core/macro'
import {
  Header,
  Main,
  usePageTitle,
  useAuthStore,
  GeneralError,
} from '@mochi/web'
import { FolderGit2 } from 'lucide-react'
import { reposRequest, repoBasePath } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryTabs, CloneDialog, UnsubscribeButton, type RepositoryTabId } from '@/features/repository/repository-tabs'
import { DownloadDropdown } from '@/components/download-dropdown'
import { setLastRepo } from '@/hooks/use-repos-storage'

const validTabs: RepositoryTabId[] = ['files', 'commits', 'branches', 'tags', 'settings', 'access']

type RepoSearch = {
  tab?: RepositoryTabId
}

export const Route = createFileRoute('/_authenticated/$repoId')({
  validateSearch: (search: Record<string, unknown>): RepoSearch => ({
    tab: validTabs.includes(search.tab as RepositoryTabId) ? (search.tab as RepositoryTabId) : undefined,
  }),
  loader: async ({ params }) => {
    const repoId = params.repoId
    if (!repoId) {
      throw new Error(t`Repository ID is required`)
    }
    const info = await reposRequest.get<InfoResponse>('info', { baseURL: repoBasePath(repoId) })
    return { ...info, repoId }
  },
  component: RepositoryPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function RepositoryPage() {
  const data = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()

  const setActiveTab = (newTab: RepositoryTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  const name = data.name || t`Repository`

  usePageTitle(name)

  // Store last visited repository for restoration on next entry (authenticated users only)
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated)
  useEffect(() => {
    if (isLoggedIn) setLastRepo(data.repoId)
  }, [isLoggedIn, data.repoId])

  return (
    <>
      <Header className="border-b-0">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            <h1 className="text-lg font-semibold">{name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <CloneDialog repoPath={data.path || ''} fingerprint={data.repoId} />
            {(tab ?? 'files') === 'files' && (
              <DownloadDropdown gitRef={data.default_branch || 'HEAD'} />
            )}
            {data.remote && (
              <UnsubscribeButton repoId={data.id || data.repoId} repoName={name} />
            )}
          </div>
        </div>
      </Header>
      <Main spacingY="xs">
        <RepositoryTabs
          key={data.repoId}
          repoId={data.id || data.repoId}
          fingerprint={data.repoId}
          name={name}
          path={data.path || ''}
          defaultBranch={data.default_branch || 'main'}
          description={data.description}
          isOwner={data.isAdmin}
          activeTab={tab ?? 'files'}
          onTabChange={setActiveTab}
        />
      </Main>
    </>
  )
}
