// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { Main, usePageTitle, GeneralError } from '@mochi/web'
import { reposRequest, repoBasePath } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useBranches } from '@/hooks/use-repository'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { CommitsList } from '@/features/repository/commits-list'
import { RefSelector } from '@/components/ref-selector'

export const Route = createFileRoute('/_authenticated/$repoId_/commits')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>('info', { baseURL: repoBasePath(params.repoId) })
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
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={fingerprint}
          repoId={repoId}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab="commits"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
          showDownload={false}
        />
        {branches.length > 0 && (
          <RefSelector branches={branches} value={currentRef} onValueChange={setCurrentRef} />
        )}
        <CommitsList repoId={repoId} fingerprint={fingerprint} currentRef={currentRef} />
      </div>
    </Main>
  )
}
