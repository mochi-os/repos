// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { Main, usePageTitle, GeneralError } from '@mochi/web'
import { reposRequest, repoBasePath } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import {
  getBranches,
  getCommits,
  primeCommits,
  primeQuery,
  repoKeys,
  startRequest,
  useBranches,
} from '@/hooks/use-repository'
import { RefSelector } from '@/components/ref-selector'
import { CommitsList } from '@/features/repository/commits-list'
import { CompareButton } from '@/features/repository/compare-button'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/$repoId_/commits')({
  // The first page of commits and the branches are asked for alongside the
  // repository's info, not after it, and handed to the page's queries once
  // the info names the repository. The commits are asked for with no ref,
  // which the server reads as the default branch the info names.
  loader: async ({ params, context }) => {
    const baseURL = repoBasePath(params.repoId)
    const branches = startRequest(getBranches(baseURL))
    const commits = startRequest(getCommits(undefined, 0, baseURL))
    const info = await reposRequest.get<InfoResponse>('info', { baseURL })
    const id = info.id || params.repoId
    primeQuery(context.queryClient, repoKeys.branches(id), branches)
    if (info.default_branch) {
      const key = repoKeys.commits(id, info.default_branch)
      primeCommits(context.queryClient, key, commits)
    }
    return { ...info, repoId: params.repoId }
  },
  component: CommitsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function CommitsPage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const repoId = data.id || data.repoId
  const fingerprint = data.fingerprint || data.repoId
  const [currentRef, setCurrentRef] = useState(data.default_branch || 'main')
  const { data: branchesData } = useBranches(repoId)
  const branches = branchesData?.branches || []

  usePageTitle(t`${data.name} commits`)

  return (
    <Main>
      <div className='space-y-4 p-4'>
        <RepositoryHeader
          fingerprint={fingerprint}
          repoId={repoId}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab='commits'
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
          showDownload={false}
        >
          {branches.length > 0 && (
            <div className='flex flex-wrap items-center gap-2'>
              <RefSelector
                branches={branches}
                value={currentRef}
                onValueChange={setCurrentRef}
              />
              <CompareButton
                fingerprint={fingerprint}
                base={branchesData?.default || data.default_branch || 'main'}
                head={currentRef}
              />
            </div>
          )}
        </RepositoryHeader>
        <CommitsList
          repoId={repoId}
          fingerprint={fingerprint}
          currentRef={currentRef}
        />
      </div>
    </Main>
  )
}
