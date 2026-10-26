// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Main, usePageTitle, requestHelpers, GeneralError } from '@mochi/web'
import type { InfoResponse } from '@/api/types'
import {
  getHistory,
  HISTORY_PAGE,
  primeQuery,
  repoKeys,
  startRequest,
} from '@/hooks/use-repository'
import { FileHistory } from '@/features/repository/file-history'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/history/$ref/$')({
  // The file's history is asked for alongside the repository's info, and
  // handed to the page's query once the info names the repository.
  loader: async ({ params, context }) => {
    const path = params._splat || ''
    const history =
      path && startRequest(getHistory(params.ref, path, HISTORY_PAGE))
    const info = await requestHelpers.get<InfoResponse>('info')
    if (history && info.entity && info.id) {
      const key = repoKeys.history(info.id, params.ref, path, HISTORY_PAGE)
      primeQuery(context.queryClient, key, history)
    }
    return info
  },
  component: HistoryPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function HistoryPage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const { ref, _splat: path } = Route.useParams()

  const fileName = path?.split('/').pop() || t`file`
  usePageTitle(t`History of ${fileName} - ${data.name}`)

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
        <FileHistory
          repoId={data.id}
          fingerprint={fingerprint}
          gitRef={ref}
          path={path || ''}
        />
      </div>
    </Main>
  )
}
