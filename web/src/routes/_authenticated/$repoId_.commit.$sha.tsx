// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { Main, usePageTitle, GeneralError } from '@mochi/web'
import { reposRequest, repoBasePath } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { commitSearch } from '@/lib/diff-options'
import {
  commitDiffRequest,
  getCommit,
  getDiff,
  primeQuery,
  repoKeys,
  startRequest,
} from '@/hooks/use-repository'
import { useCommitChanges } from '@/features/repository/commit-changes'
import { CommitDetails } from '@/features/repository/commit-details'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/$repoId_/commit/$sha')({
  validateSearch: commitSearch,
  // The commit and its diff are asked for alongside the repository's info,
  // not after it, and handed to the page's queries once the info names the
  // repository.
  loader: async ({ params, location, context }) => {
    const baseURL = repoBasePath(params.repoId)
    const request = commitDiffRequest(params.sha, commitSearch(location.search))
    const commit = startRequest(getCommit(params.sha, baseURL))
    const diff = startRequest(getDiff(request, baseURL))
    const info = await reposRequest.get<InfoResponse>('info', { baseURL })
    const id = info.id || params.repoId
    primeQuery(context.queryClient, repoKeys.commit(id, params.sha), commit)
    primeQuery(context.queryClient, repoKeys.diff(id, request), diff)
    return { ...info, repoId: params.repoId }
  },
  component: CommitPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function CommitPage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const { sha } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const changes = useCommitChanges({
    repoId: data.id || data.repoId,
    fingerprint: data.repoId,
    sha,
    search,
    onSearch: (next) =>
      void navigate({
        search: (previous) => ({ ...previous, ...next }),
        replace: true,
      }),
  })

  usePageTitle(t`Commit ${sha.substring(0, 7)} - ${data.name}`)

  return (
    <Main>
      <div className='space-y-4 p-4'>
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab='commits'
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
          currentRef={sha}
        >
          {changes.bar}
        </RepositoryHeader>
        <CommitDetails
          repoId={data.id || data.repoId}
          fingerprint={data.repoId}
          sha={sha}
        />
        {changes.body}
      </div>
    </Main>
  )
}
