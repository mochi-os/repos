// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/request')>()),
  reposRequest: { get },
  repoBasePath: (id: string) => `/repositories/${id}/-/`,
}))

import {
  commitDiffRequest,
  compareDiffRequest,
  HISTORY_PAGE,
  repoKeys,
} from './use-repository'
import { Route as CommitRoute } from '@/routes/_authenticated/$repoId_.commit.$sha'
import { Route as CompareRoute } from '@/routes/_authenticated/$repoId_.compare.$'
import { Route as HistoryRoute } from '@/routes/_authenticated/$repoId_.history.$ref.$'

const sha = 'a'.repeat(40)

// Answers every request at once except the repository's info, which waits
// until the test lets it go, so what was asked for meanwhile can be seen.
function server() {
  let release: (value: unknown) => void = () => {}
  get.mockImplementation((url: string) =>
    url === 'info'
      ? new Promise((resolve) => {
          release = resolve
        })
      : Promise.resolve({ url })
  )
  return {
    asked: () => get.mock.calls.map((call) => call[0] as string),
    info: () => release({ id: 'entity', name: 'Repository' }),
  }
}

// A route's loader, called as the router calls it.
const load = (route: { options: { loader?: unknown } }, args: never) =>
  (route.options.loader as (args: never) => Promise<unknown>)(args)

// What a loader receives; the routes read only these.
function loaderArgs(params: Record<string, string>, search = {}) {
  const queryClient = new QueryClient()
  return {
    queryClient,
    args: { params, location: { search }, context: { queryClient } } as never,
  }
}

// The page's own query under key, which must not ask the server again.
async function taken(queryClient: QueryClient, key: readonly unknown[]) {
  const asked = get.mock.calls.length
  const data = await queryClient.ensureQueryData({
    queryKey: key,
    queryFn: () => get('asked again'),
  })
  expect(get.mock.calls.length).toBe(asked)
  return data
}

describe('route loaders', () => {
  beforeEach(() => get.mockReset())

  it('asks for a commit and its diff alongside the info, not after it', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp', sha })
    const loading = load(CommitRoute, args)
    // THE POINT: both are on their way while the info still is.
    expect(answers.asked()).toEqual(['commit/' + sha, 'diff', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.commit('entity', sha))
    ).resolves.toEqual({ url: 'commit/' + sha })
    await expect(
      taken(queryClient, repoKeys.diff('entity', commitDiffRequest(sha, {})))
    ).resolves.toEqual({ url: 'diff' })
  })

  it('asks for the diff from the parent the address names', async () => {
    const answers = server()
    const parent = 'b'.repeat(40)
    const { args } = loaderArgs({ repoId: 'fp', sha }, { parent })
    const loading = load(CommitRoute, args)
    answers.info()
    await loading
    const diff = get.mock.calls.find((call) => call[0] === 'diff')
    expect(diff?.[1].params).toMatchObject({ base: parent, head: sha })
  })

  it('asks for a comparison alongside the info when the address names both sides', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({
      repoId: 'fp',
      _splat: 'main...feature',
    })
    const loading = load(CompareRoute, args)
    expect(answers.asked()).toEqual(['diff', 'info'])
    answers.info()
    await loading
    const request = compareDiffRequest('main', 'feature', {})
    await expect(
      taken(queryClient, repoKeys.diff('entity', request))
    ).resolves.toEqual({ url: 'diff' })
  })

  it('leaves a comparison naming only its base to the page', async () => {
    const answers = server()
    const { args } = loaderArgs({ repoId: 'fp', _splat: 'main' })
    const loading = load(CompareRoute, args)
    expect(answers.asked()).toEqual(['info'])
    answers.info()
    await loading
  })

  it("asks for a file's history alongside the info", async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({
      repoId: 'fp',
      ref: 'main',
      _splat: 'src/a.go',
    })
    const loading = load(HistoryRoute, args)
    expect(answers.asked()).toEqual(['history/main/src/a.go', 'info'])
    answers.info()
    await loading
    await expect(
      taken(
        queryClient,
        repoKeys.history('entity', 'main', 'src/a.go', HISTORY_PAGE)
      )
    ).resolves.toEqual({ url: 'history/main/src/a.go' })
  })
})
