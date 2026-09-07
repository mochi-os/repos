// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { Main, usePageTitle, GeneralError } from '@mochi/web'
import { reposRequest, repoBasePath } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { BranchesList } from '@/features/repository/branches-list'

export const Route = createFileRoute('/_authenticated/$repoId_/branches')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>('info', { baseURL: repoBasePath(params.repoId) })
    return { ...info, repoId: params.repoId }
  },
  component: BranchesPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function BranchesPage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()

  usePageTitle(t`${data.name} branches`)

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab="branches"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />
        <BranchesList
          repoId={data.id || data.repoId}
          fingerprint={data.fingerprint || data.repoId}
          defaultBranch={data.default_branch || 'main'}
          canManage={data.isAdmin}
        />
      </div>
    </Main>
  )
}
