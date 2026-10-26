// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Main, usePageTitle, requestHelpers, GeneralError } from '@mochi/web'
import type { InfoResponse } from '@/api/types'
import {
  getBlob,
  getBranches,
  primeQuery,
  repoKeys,
  startRequest,
} from '@/hooks/use-repository'
import { BlobViewer } from '@/features/repository/blob-viewer'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/blob/$ref/$')({
  // The file and the branches are asked for alongside the repository's info,
  // not after it, and handed to the page's queries once the info names the
  // repository.
  loader: async ({ params, context }) => {
    const path = params._splat || ''
    const branches = startRequest(getBranches())
    const blob = path && startRequest(getBlob(params.ref, path))
    const info = await requestHelpers.get<InfoResponse>('info')
    if (info.entity && info.id) {
      primeQuery(context.queryClient, repoKeys.branches(info.id), branches)
      if (blob) {
        const key = repoKeys.blob(info.id, params.ref, path)
        primeQuery(context.queryClient, key, blob)
      }
    }
    return info
  },
  component: BlobPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function BlobPage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const { ref, _splat: path } = Route.useParams()

  const fileName = path?.split('/').pop() || t`file`
  usePageTitle(`${fileName} - ${data.name}`)

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
        <BlobViewer
          repoId={data.id}
          fingerprint={fingerprint}
          name={data.name || t`Repository`}
          gitRef={ref}
          path={path || ''}
        />
      </div>
    </Main>
  )
}
