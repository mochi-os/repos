// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/request')>()),
  reposRequest: { get },
  repoBasePath: (id: string) => `/repositories/${id}/-/`,
}))
// A repository on its own domain asks for its info through requestHelpers.
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  requestHelpers: { get },
}))

import {
  commitDiffRequest,
  compareDiffRequest,
  HISTORY_PAGE,
  primeCommits,
  primeQuery,
  repoKeys,
  useBlob,
  useBranches,
  useCommits,
  useHistory,
  useTags,
  useTree,
} from './use-repository'
import { Route as RepositoryRoute } from '@/routes/_authenticated/$repoId'
import { Route as BlobRoute } from '@/routes/_authenticated/$repoId_.blob.$ref.$'
import { Route as BranchesRoute } from '@/routes/_authenticated/$repoId_.branches'
import { Route as CommitRoute } from '@/routes/_authenticated/$repoId_.commit.$sha'
import { Route as CommitsRoute } from '@/routes/_authenticated/$repoId_.commits'
import { Route as CompareRoute } from '@/routes/_authenticated/$repoId_.compare.$'
import { Route as HistoryRoute } from '@/routes/_authenticated/$repoId_.history.$ref.$'
import { Route as TagsRoute } from '@/routes/_authenticated/$repoId_.tags'
import { Route as TreeRoute } from '@/routes/_authenticated/$repoId_.tree.$ref.$'
import { Route as DomainBlobRoute } from '@/routes/_authenticated/blob/$ref/$'
import { Route as DomainTreeRoute } from '@/routes/_authenticated/tree/$ref/$'

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
      : Promise.resolve(
          url === 'commits' ? { commits: [{ sha: 'tip' }] } : { url }
        )
  )
  return {
    asked: () => get.mock.calls.map((call) => call[0] as string),
    info: (fields = {}) =>
      release({
        entity: true,
        id: 'entity',
        name: 'Repository',
        default_branch: 'main',
        ...fields,
      }),
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

// The queries a loader left for the repository, whatever their keys.
const primed = (queryClient: QueryClient) =>
  queryClient.getQueryCache().findAll({ queryKey: [...repoKeys.all, 'entity'] })

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

  it("asks for the default branch's files and the branches alongside the info", async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp' })
    const loading = load(RepositoryRoute, args)
    // THE POINT: the files go out with no ref, before the info names the
    // branch, and the server reads no ref as that branch.
    expect(answers.asked()).toEqual(['branches', 'tree', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.tree('entity', 'main', ''))
    ).resolves.toEqual({ url: 'tree' })
    await expect(
      taken(queryClient, repoKeys.branches('entity'))
    ).resolves.toEqual({ url: 'branches' })
  })

  it("asks for the commits tab's first page alongside the info", async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs(
      { repoId: 'fp' },
      { tab: 'commits' }
    )
    const loading = load(RepositoryRoute, args)
    expect(answers.asked()).toEqual(['branches', 'commits', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.commits('entity', 'main'))
    ).resolves.toEqual({ pages: [[{ sha: 'tip' }]], pageParams: [0] })
  })

  it("asks for the tags tab's list alongside the info", async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp' }, { tab: 'tags' })
    const loading = load(RepositoryRoute, args)
    expect(answers.asked()).toEqual(['branches', 'tags', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.tags('entity'))
    ).resolves.toEqual({ url: 'tags' })
  })

  it('asks the branches tab for nothing past the branches every tab shows', async () => {
    const answers = server()
    const { args } = loaderArgs({ repoId: 'fp' }, { tab: 'branches' })
    const loading = load(RepositoryRoute, args)
    expect(answers.asked()).toEqual(['branches', 'info'])
    answers.info()
    await loading
  })

  it('leaves the files to the page when the info names no default branch', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp' })
    const loading = load(RepositoryRoute, args)
    answers.info({ default_branch: '' })
    await loading
    expect(
      primed(queryClient).map((query) => query.queryKey[2])
    ).toEqual(['branches'])
  })

  it('asks for a folder and the branches alongside the info', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({
      repoId: 'fp',
      ref: 'main',
      _splat: 'src',
    })
    const loading = load(TreeRoute, args)
    expect(answers.asked()).toEqual(['branches', 'tree/main/src', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.tree('entity', 'main', 'src'))
    ).resolves.toEqual({ url: 'tree/main/src' })
    await expect(
      taken(queryClient, repoKeys.branches('entity'))
    ).resolves.toEqual({ url: 'branches' })
  })

  it('asks for a file and the branches alongside the info', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({
      repoId: 'fp',
      ref: 'main',
      _splat: 'src/a.go',
    })
    const loading = load(BlobRoute, args)
    expect(answers.asked()).toEqual(['branches', 'blob/main/src/a.go', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.blob('entity', 'main', 'src/a.go'))
    ).resolves.toEqual({ url: 'blob/main/src/a.go' })
    await expect(
      taken(queryClient, repoKeys.branches('entity'))
    ).resolves.toEqual({ url: 'branches' })
  })

  it("asks for the default branch's commits alongside the info", async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp' })
    const loading = load(CommitsRoute, args)
    expect(answers.asked()).toEqual(['branches', 'commits', 'info'])
    expect(get.mock.calls[1][1].params).toEqual({ limit: 50, offset: 0 })
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.commits('entity', 'main'))
    ).resolves.toEqual({ pages: [[{ sha: 'tip' }]], pageParams: [0] })
    await expect(
      taken(queryClient, repoKeys.branches('entity'))
    ).resolves.toEqual({ url: 'branches' })
  })

  it('leaves the commits to the page when the info names no default branch', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp' })
    const loading = load(CommitsRoute, args)
    answers.info({ default_branch: '' })
    await loading
    expect(
      primed(queryClient).map((query) => query.queryKey[2])
    ).toEqual(['branches'])
  })

  it('asks for the branches alongside the info', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp' })
    const loading = load(BranchesRoute, args)
    expect(answers.asked()).toEqual(['branches', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.branches('entity'))
    ).resolves.toEqual({ url: 'branches' })
  })

  it('asks for the tags alongside the info', async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ repoId: 'fp' })
    const loading = load(TagsRoute, args)
    expect(answers.asked()).toEqual(['tags', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.tags('entity'))
    ).resolves.toEqual({ url: 'tags' })
  })

  it("asks for a folder on a repository's own domain alongside the info", async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ ref: 'main', _splat: 'src' })
    const loading = load(DomainTreeRoute, args)
    expect(answers.asked()).toEqual(['branches', 'tree/main/src', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.tree('entity', 'main', 'src'))
    ).resolves.toEqual({ url: 'tree/main/src' })
  })

  it("asks for a file on a repository's own domain alongside the info", async () => {
    const answers = server()
    const { queryClient, args } = loaderArgs({ ref: 'main', _splat: 'a.go' })
    const loading = load(DomainBlobRoute, args)
    expect(answers.asked()).toEqual(['branches', 'blob/main/a.go', 'info'])
    answers.info()
    await loading
    await expect(
      taken(queryClient, repoKeys.blob('entity', 'main', 'a.go'))
    ).resolves.toEqual({ url: 'blob/main/a.go' })
  })

  it('hands nothing on to a domain whose info names no repository', async () => {
    for (const route of [DomainTreeRoute, DomainBlobRoute]) {
      const answers = server()
      const { queryClient, args } = loaderArgs({ ref: 'main', _splat: 'a' })
      const loading = load(route, args)
      answers.info({ entity: false })
      await loading
      expect(primed(queryClient)).toEqual([])
    }
  })
})

// What a loader handed on is taken as current when the page's hook mounts,
// rather than asked for again: the query client takes everything as stale at
// once unless the hook says otherwise.
describe('a page taking up what its loader fetched', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ asked: 'again' })
  })

  const history = repoKeys.history('entity', 'main', 'a.go', HISTORY_PAGE)
  const cases: [
    string,
    readonly unknown[],
    (queryClient: QueryClient) => void,
    () => { data: unknown },
  ][] = [
    [
      'branches',
      repoKeys.branches('entity'),
      (client) =>
        primeQuery(
          client,
          repoKeys.branches('entity'),
          Promise.resolve({ branches: [] })
        ),
      () => useBranches('entity'),
    ],
    [
      'tags',
      repoKeys.tags('entity'),
      (client) =>
        primeQuery(client, repoKeys.tags('entity'), Promise.resolve({ tags: [] })),
      () => useTags('entity'),
    ],
    [
      'a folder',
      repoKeys.tree('entity', 'main', 'src'),
      (client) =>
        primeQuery(
          client,
          repoKeys.tree('entity', 'main', 'src'),
          Promise.resolve({ entries: [] })
        ),
      () => useTree('entity', 'main', 'src'),
    ],
    [
      'a file',
      repoKeys.blob('entity', 'main', 'a.go'),
      (client) =>
        primeQuery(
          client,
          repoKeys.blob('entity', 'main', 'a.go'),
          Promise.resolve({ content: '' })
        ),
      () => useBlob('entity', 'main', 'a.go'),
    ],
    [
      'the commits',
      repoKeys.commits('entity', 'main'),
      (client) =>
        primeCommits(
          client,
          repoKeys.commits('entity', 'main'),
          Promise.resolve([{ sha: 'tip', message: '', author: '', date: 0 }])
        ),
      () => useCommits('entity', 'main'),
    ],
    [
      "a file's history",
      history,
      (client) => primeQuery(client, history, Promise.resolve({ commits: [] })),
      () => useHistory('entity', 'main', 'a.go', HISTORY_PAGE),
    ],
  ]

  it.each(cases)('%s', async (_name, key, prime, hook) => {
    const queryClient = new QueryClient()
    prime(queryClient)
    await waitFor(() =>
      expect(queryClient.getQueryState(key)?.status).toBe('success')
    )
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(hook, { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())
    // THE POINT: the hook takes up the answer rather than asking again.
    expect(get).not.toHaveBeenCalled()
  })
})

describe('the commits list', () => {
  // A page as full as the server sends one.
  const page = Array.from({ length: 50 }, (_, index) => ({
    sha: `${index}`,
    message: '',
    author: '',
    date: 0,
  }))

  // The server lists no deeper than offset 10,000, so the 201st page, at
  // 10,000, is the last one asked for.
  it.each([
    [200, true],
    [201, false],
  ])('after %i full pages, asks for more: %s', async (count, more) => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(repoKeys.commits('entity', sha), {
      pages: Array.from({ length: count }, () => page),
      pageParams: Array.from({ length: count }, (_, index) => index * 50),
    })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(() => useCommits('entity', sha), {
      wrapper,
    })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.hasNextPage).toBe(more)
  })
})
