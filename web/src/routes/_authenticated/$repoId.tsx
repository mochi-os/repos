// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
import {
  getBranches,
  getCommits,
  getTags,
  getTree,
  primeCommits,
  primeQuery,
  repoKeys,
  startRequest,
} from '@/hooks/use-repository'
import { setLastRepo } from '@/hooks/use-repos-storage'
import { useRepositoryWebsocket } from '@/hooks/use-repository-websocket'
import { RepositoryActions } from '@/features/repository/repository-actions'
import {
  RepositoryTabs,
  type RepositoryTabId,
} from '@/features/repository/repository-tabs'

const validTabs: RepositoryTabId[] = [
  'files',
  'commits',
  'branches',
  'tags',
  'settings',
  'access',
]

type RepoSearch = {
  tab?: RepositoryTabId
}

const repoSearch = (search: Record<string, unknown>): RepoSearch => ({
  tab: validTabs.includes(search.tab as RepositoryTabId)
    ? (search.tab as RepositoryTabId)
    : undefined,
})

export const Route = createFileRoute('/_authenticated/$repoId')({
  validateSearch: repoSearch,
  // The branches every tab shows, and the open tab's list, are asked for
  // alongside the repository's info, not after it, and handed to the page's
  // queries once the info names the repository. The files and commits tabs
  // ask with no ref, which the server reads as the default branch the info
  // names.
  loader: async ({ params, location, context }) => {
    const repoId = params.repoId
    if (!repoId) {
      throw new Error(t`Repository ID is required`)
    }
    const baseURL = repoBasePath(repoId)
    const tab = repoSearch(location.search).tab ?? 'files'
    const branches = startRequest(getBranches(baseURL))
    const tree = tab === 'files' && startRequest(getTree('', '', baseURL))
    const commits =
      tab === 'commits' && startRequest(getCommits(undefined, 0, baseURL))
    const tags = tab === 'tags' && startRequest(getTags(baseURL))
    const info = await reposRequest.get<InfoResponse>('info', { baseURL })
    const id = info.id || repoId
    const ref = info.default_branch
    primeQuery(context.queryClient, repoKeys.branches(id), branches)
    if (tree && ref) {
      primeQuery(context.queryClient, repoKeys.tree(id, ref, ''), tree)
    }
    if (commits && ref) {
      primeCommits(context.queryClient, repoKeys.commits(id, ref), commits)
    }
    if (tags) {
      primeQuery(context.queryClient, repoKeys.tags(id), tags)
    }
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

  // Refresh a subscribed repository the moment the owner's metadata edit or
  // push activity lands locally, instead of waiting for a manual reload.
  // notify_websocket writes to the fingerprint, and data.repoId is only the URL
  // segment - which is the entity id whenever the user arrived from search or
  // from find, exactly the case this exists for. Use the resolved fingerprint.
  const fingerprint = data.fingerprint || data.repoId
  useRepositoryWebsocket(fingerprint)

  // Store last visited repository for restoration on next entry (authenticated users only)
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated)
  useEffect(() => {
    if (isLoggedIn) setLastRepo(data.repoId)
  }, [isLoggedIn, data.repoId])

  return (
    <>
      <Header className='border-b-0'>
        <div className='flex w-full items-center justify-between gap-2'>
          <div className='flex min-w-0 items-center gap-2'>
            <FolderGit2 className='h-5 w-5 shrink-0' />
            <h1 className='truncate text-lg font-semibold'>{name}</h1>
          </div>
          <RepositoryActions
            fingerprint={fingerprint}
            path={data.path || ''}
            downloadRef={data.default_branch || 'HEAD'}
            isOwner={data.isAdmin}
            subscription={
              data.remote ? { repoId: data.id || data.repoId, name } : undefined
            }
          />
        </div>
      </Header>
      <Main spacingY='xs'>
        <RepositoryTabs
          key={data.repoId}
          repoId={data.id || data.repoId}
          fingerprint={fingerprint}
          name={name}
          path={data.path || ''}
          defaultBranch={data.default_branch || 'main'}
          description={data.description}
          allowRead={data.allow_read}
          privacy={data.privacy}
          isOwner={data.isAdmin}
          activeTab={tab ?? 'files'}
          onTabChange={setActiveTab}
        />
      </Main>
    </>
  )
}
