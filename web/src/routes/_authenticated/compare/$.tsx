// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createFileRoute } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Main, usePageTitle, requestHelpers, GeneralError } from '@mochi/web'
import type { InfoResponse } from '@/api/types'
import { compareRange, compareSearch } from '@/lib/diff-options'
import { useBranches } from '@/hooks/use-repository'
import { useCompare } from '@/features/repository/compare-view'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/compare/$')({
  validateSearch: compareSearch,
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>('info')
    return info
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
  const repoId = data.id ?? ''
  const fallback =
    useBranches(repoId).data?.default || data.default_branch || 'main'
  const { base, head } = compareRange(_splat, fallback)
  const compare = useCompare({
    repoId,
    fingerprint: data.fingerprint || repoId,
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
