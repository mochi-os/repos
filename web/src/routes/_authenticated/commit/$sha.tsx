// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute, Link } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Header,
  Main,
  Button,
  StickyBar,
  usePageTitle,
  GeneralError,
} from '@mochi/web'
import { FolderGit2, ArrowLeft } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { commitSearch } from '@/lib/diff-options'
import {
  commitDiffRequest,
  getCommit,
  getDiff,
  commitFresh,
  diffFresh,
  primeQuery,
  rememberRepository,
  repoKeys,
  startUnlessFresh,
} from '@/hooks/use-repository'
import { useCommitChanges } from '@/features/repository/commit-changes'
import { CommitDetails } from '@/features/repository/commit-details'

export const Route = createFileRoute('/_authenticated/commit/$sha')({
  validateSearch: commitSearch,
  // The commit and its diff are asked for alongside the repository's info,
  // not after it, and handed to the page's queries once the info names the
  // repository.
  loader: async ({ params, location, context }) => {
    const request = commitDiffRequest(params.sha, commitSearch(location.search))
    const queryClient = context.queryClient
    const commit = startUnlessFresh(
      queryClient,
      '',
      (id) => repoKeys.commit(id, params.sha),
      commitFresh(params.sha),
      () => getCommit(params.sha)
    )
    const diff = startUnlessFresh(
      queryClient,
      '',
      (id) => repoKeys.diff(id, request),
      diffFresh(request),
      () => getDiff(request)
    )
    const info = await reposRequest.get<InfoResponse>('info')
    if (info.entity && info.id) {
      rememberRepository('', info.id)
      primeQuery(queryClient, repoKeys.commit(info.id, params.sha), commit)
      primeQuery(queryClient, repoKeys.diff(info.id, request), diff)
    }
    return info
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
    repoId: data.id ?? '',
    fingerprint: data.fingerprint || data.id || '',
    sha,
    search,
    onSearch: (next) =>
      void navigate({
        search: (previous) => ({ ...previous, ...next }),
        replace: true,
      }),
  })

  usePageTitle(t`Commit ${sha.substring(0, 7)} - ${data.name}`)

  if (!data.entity || !data.id) {
    return (
      <>
        <Header>
          <h1 className='text-lg font-semibold'>
            <Trans>Repository not found</Trans>
          </h1>
        </Header>
        <Main>
          <div className='text-muted-foreground p-4'>
            <Trans>This page requires a repository context.</Trans>
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header className='border-b-0'>
        <div className='flex items-center gap-2'>
          <FolderGit2 className='h-5 w-5' />
          <h1 className='text-lg font-semibold'>{data.name}</h1>
          <span className='text-muted-foreground'>/</span>
          <span>
            <Trans>Commit</Trans>
          </span>
        </div>
      </Header>
      <Main spacingY='xs'>
        <div className='space-y-4 p-4'>
          <div className='flex items-center gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link
                to='/$repoId/commits'
                params={{ repoId: data.fingerprint || data.id }}
              >
                <ArrowLeft className='me-1 h-4 w-4 rtl:rotate-180' />
                <Trans>Back to commits</Trans>
              </Link>
            </Button>
          </div>
          <CommitDetails
            repoId={data.id}
            fingerprint={data.fingerprint || data.id}
            sha={sha}
          />
          {changes.bar && (
            <StickyBar className='-mt-2 py-2'>{changes.bar}</StickyBar>
          )}
          {changes.body}
        </div>
      </Main>
    </>
  )
}
