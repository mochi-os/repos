// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/web'
import { reposRequest, repoBasePath } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { BlobViewer } from '@/features/repository/blob-viewer'

export const Route = createFileRoute('/_authenticated/$repoId_/blob/$ref/$')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>('info', { baseURL: repoBasePath(params.repoId) })
    return { ...info, repoId: params.repoId }
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

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab="files"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />
        <BlobViewer
          repoId={data.id || data.repoId}
          fingerprint={data.repoId}
          gitRef={ref}
          path={path || ''}
          name={data.name || t`Repository`}
        />
      </div>
    </Main>
  )
}
