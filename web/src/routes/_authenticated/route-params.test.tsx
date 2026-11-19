// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// Every repository route's loader builds its action prefix from $repoId, which
// the router hands it percent-decoded, so a link could make the owner's page
// GET `<fp>/-/access/set?subject=...` or `<fp>/-/delete` with its token. A
// $repoId that does not name a repository is not found, and the loader asks
// for nothing.
import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type AnyRoute,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route as RepositoryRoute } from './$repoId'
import { Route as BlobRoute } from './$repoId_.blob.$ref.$'
import { Route as BranchesRoute } from './$repoId_.branches'
import { Route as CommitRoute } from './$repoId_.commit.$sha'
import { Route as CommitsRoute } from './$repoId_.commits'
import { Route as CompareRoute } from './$repoId_.compare.$'
import { Route as HistoryRoute } from './$repoId_.history.$ref.$'
import { Route as TagsRoute } from './$repoId_.tags'
import { Route as TreeRoute } from './$repoId_.tree.$ref.$'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/api/request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/request')>()),
  reposRequest: { get, post: vi.fn(), download: vi.fn() },
}))

const FINGERPRINT = 'va7kZSfKM'
const SHA = '0123456789abcdef0123456789abcdef01234567'

const routes: Array<[string, AnyRoute]> = [
  ['$repoId', RepositoryRoute],
  ['$repoId/blob/$ref/$', BlobRoute],
  ['$repoId/branches', BranchesRoute],
  ['$repoId/commit/$sha', CommitRoute],
  ['$repoId/commits', CommitsRoute],
  ['$repoId/compare/$', CompareRoute],
  ['$repoId/history/$ref/$', HistoryRoute],
  ['$repoId/tags', TagsRoute],
  ['$repoId/tree/$ref/$', TreeRoute],
]

// The page each route would draw, after its loader: the routes' own pages
// are their own concern.
function open(address: string) {
  const root = createRootRoute({
    component: Outlet,
    notFoundComponent: () => <p>not found</p>,
  })
  const children = routes.map(([path, route]) => {
    const { loader } = route.options as {
      loader: (context: never) => unknown
    }
    return createRoute({
      getParentRoute: () => root,
      path,
      loader: (context) => loader(context as never),
      component: () => <p>{path}</p>,
    })
  })
  const router = createRouter({
    routeTree: root.addChildren(children),
    history: createMemoryHistory({ initialEntries: [address] }),
    context: { queryClient: new QueryClient() },
  })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ id: 'r1', default_branch: 'main' })
  // A repository on the app's own path, as a visitor's page is.
  window.history.replaceState(null, '', `/repositories/${FINGERPRINT}`)
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

// The climbs a link can spell: each decodes to `<fp>/-/<action>` with inputs.
const grant = `${FINGERPRINT}%2F-%2Faccess%2Fset%3Fsubject%3Dx%26permission%3Dwrite%23`
const remove = `${FINGERPRINT}%2F-%2Fdelete%23`

describe('repository routes', () => {
  it.each([
    ['the repository page', `/${grant}`],
    ['a file', `/${remove}/blob/main/README.md`],
    ['the branches', `/${remove}/branches`],
    ['a commit', `/${remove}/commit/${SHA}`],
    ['the commits', `/${remove}/commits`],
    ['a comparison', `/${remove}/compare/main...dev`],
    ['a history', `/${remove}/history/main/README.md`],
    ['the tags', `/${remove}/tags`],
    ['a tree', `/${remove}/tree/main/src`],
  ])('refuse %s under a crafted id with no request', async (_name, address) => {
    open(address)
    expect(await screen.findByText('not found')).toBeTruthy()
    expect(get).not.toHaveBeenCalled()
  })

  // CONTROL: the same loaders ask the routed repository's own prefix.
  it.each([
    ['the repository page', `/${FINGERPRINT}`, '$repoId'],
    ['the branches', `/${FINGERPRINT}/branches`, '$repoId/branches'],
    ['a tree', `/${FINGERPRINT}/tree/main/src`, '$repoId/tree/$ref/$'],
  ])('open %s', async (_name, address, page) => {
    open(address)
    expect(await screen.findByText(page)).toBeTruthy()
    expect(get).toHaveBeenCalledWith('info', {
      baseURL: `/repositories/${FINGERPRINT}/-/`,
    })
  })
})
