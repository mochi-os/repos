// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { Main, usePageTitle, GeneralError } from '@mochi/web'
import { reposRequest, repoBasePath } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { compareRange, compareSearch } from '@/lib/diff-options'
import { useBranches } from '@/hooks/use-repository'
import { useCompare } from '@/features/repository/compare-view'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/$repoId_/compare/$')({
  validateSearch: compareSearch,
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>('info', {
      baseURL: repoBasePath(params.repoId),
    })
    return { ...info, repoId: params.repoId }
  },
  component: ComparePage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function ComparePage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const { _splat } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const repoId = data.id || data.repoId
  const fallback =
    useBranches(repoId).data?.default || data.default_branch || 'main'
  const { base, head } = compareRange(_splat, fallback)
  const compare = useCompare({
    repoId,
    fingerprint: data.repoId,
    base,
    head,
    search,
    onSearch: (next) =>
      void navigate({
        search: (previous) => ({ ...previous, ...next }),
        replace: true,
      }),
    onRange: (from, to) =>
      void navigate({
        params: (previous) => ({ ...previous, _splat: `${from}...${to}` }),
        search: (previous) => previous,
      }),
  })

  usePageTitle(t`Compare - ${data.name}`)

  return (
    <Main>
      <div className='space-y-4 p-4'>
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={repoId}
          name={data.name || t`Repository`}
          path={data.path || ''}
          description={data.description}
          activeTab='commits'
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
          showDownload={false}
        >
          {compare.bar}
        </RepositoryHeader>
        {compare.body}
      </div>
    </Main>
  )
}
