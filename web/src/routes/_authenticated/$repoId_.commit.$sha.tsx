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
import { CommitDetails } from '@/features/repository/commit-details'

export const Route = createFileRoute('/_authenticated/$repoId_/commit/$sha')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>('info', { baseURL: repoBasePath(params.repoId) })
    return { ...info, repoId: params.repoId }
  },
  component: CommitPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function CommitPage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const { sha } = Route.useParams()

  usePageTitle(t`Commit ${sha.substring(0, 7)} - ${data.name}`)

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab="commits"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
          currentRef={sha}
        />
        <CommitDetails repoId={data.id || data.repoId} fingerprint={data.repoId} sha={sha} />
      </div>
    </Main>
  )
}
