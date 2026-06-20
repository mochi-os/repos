// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Main,
  usePageTitle,
  requestHelpers,
  GeneralError,
} from '@mochi/web'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { BlobViewer } from '@/features/repository/blob-viewer'

export const Route = createFileRoute('/_authenticated/blob/$ref/$')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.repo.info)
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
        <div className="p-4 text-muted-foreground">
          <Trans>This page requires a repository context.</Trans>
        </div>
      </Main>
    )
  }

  const fingerprint = data.fingerprint || data.id

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={fingerprint}
          repoId={data.id}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab="files"
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
