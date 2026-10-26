// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Main, usePageTitle, requestHelpers, GeneralError } from '@mochi/web'
import type { InfoResponse } from '@/api/types'
import {
  getBranches,
  getTree,
  primeQuery,
  repoKeys,
  startRequest,
} from '@/hooks/use-repository'
import { FileTree } from '@/features/repository/file-browser'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/tree/$ref/$')({
  // The folder and the branches are asked for alongside the repository's
  // info, not after it, and handed to the page's queries once the info names
  // the repository.
  loader: async ({ params, context }) => {
    const path = params._splat || ''
    const branches = startRequest(getBranches())
    const tree = startRequest(getTree(params.ref, path))
    const info = await requestHelpers.get<InfoResponse>('info')
    if (info.entity && info.id) {
      primeQuery(context.queryClient, repoKeys.branches(info.id), branches)
      primeQuery(
        context.queryClient,
        repoKeys.tree(info.id, params.ref, path),
        tree
      )
    }
    return info
  },
  component: TreePage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function TreePage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const { ref, _splat: path } = Route.useParams()

  usePageTitle(`${path || data.name || t`Files`} - ${data.name}`)

  if (!data.entity || !data.id) {
    return (
      <Main>
        <div className='text-muted-foreground p-4'>
          <Trans>This page requires a repository context.</Trans>
        </div>
      </Main>
    )
  }

  const fingerprint = data.fingerprint || data.id

  return (
    <Main>
      <div className='space-y-4 p-4'>
        <RepositoryHeader
          fingerprint={fingerprint}
          repoId={data.id}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab='files'
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />
        <FileTree
          repoId={data.id}
          fingerprint={fingerprint}
          name={data.name || t`Repository`}
          defaultBranch={data.default_branch || 'main'}
          currentRef={ref}
          currentPath={path || ''}
        />
      </div>
    </Main>
  )
}
