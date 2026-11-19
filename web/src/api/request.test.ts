// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { isNotFound } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  anonymousRefusal,
  appBasePath,
  infoRequest,
  repoBasePath,
} from './request'

// What the server tells the page about its route. Core publishes mochi:app on
// an entity domain route as well as on the app's own path, so getAppPath names
// the app even where the URL does not carry it.
const path = vi.hoisted(() => ({
  app: '/repositories',
  domain: false,
  fingerprint: null as string | null,
  api: '/repositories/',
}))

vi.mock('@mochi/web', () => ({
  createAppClient: () => ({}),
  getApiBasepath: () => path.api,
  getAppPath: () => path.app,
  getEntityFingerprint: () => path.fingerprint,
  isDomainEntityRouting: () => path.domain,
  requestHelpers: {
    isAuthError: (error: unknown) =>
      (error as { status?: number } | null)?.status === 401,
  },
  shellSaveBlob: () => undefined,
}))

afterEach(() => {
  path.app = '/repositories'
  path.domain = false
  path.fingerprint = null
  path.api = '/repositories/'
})

// git.mochi-os.org routes /chat to the Chat repository, /repositories to the
// Repositories repository, and / to the app.
function chatRoute() {
  path.domain = true
  path.fingerprint = 'Chat12345'
  path.api = '/chat/-/'
}

function domainRoot() {
  path.domain = true
  path.app = ''
  path.api = '/-/'
}

// With no account to list repositories for, core answers an anonymous
// visitor's class-level request with 401. On the app's own path that visitor
// belongs on the sign-in landing page; on a domain-routed host such as
// git.mochi-os.org the route owner's repositories answer anonymously, so a 401
// there is a real error to show.
describe('anonymous refusal', () => {
  it('is a 401 on the app path', () => {
    expect(anonymousRefusal({ status: 401 })).toBe(true)
  })

  it('is not a 401 on a domain-routed host', () => {
    path.domain = true
    expect(anonymousRefusal({ status: 401 })).toBe(false)
  })

  it('is not any other failure', () => {
    expect(anonymousRefusal({ status: 500 })).toBe(false)
    expect(anonymousRefusal(new Error('network'))).toBe(false)
  })
})

describe('class-level requests', () => {
  it('go under the app path on the main host', () => {
    expect(appBasePath()).toBe('/repositories/')
  })

  it('go to the domain root from an entity domain route', () => {
    // /repositories/ is another repository's route there.
    chatRoute()
    expect(appBasePath()).toBe('/')
  })

  it('go to the domain root from the domain app route', () => {
    domainRoot()
    expect(appBasePath()).toBe('/')
  })
})

describe('index page info', () => {
  it('is the repository list on the app path', () => {
    expect(infoRequest()).toEqual({
      url: '-/info',
      baseURL: '/repositories/',
    })
  })

  it("is the routed repository's own on an entity domain route", () => {
    chatRoute()
    expect(infoRequest()).toEqual({ url: 'info', baseURL: '/chat/-/' })
  })

  it('is the repository list on the domain app route', () => {
    domainRoot()
    expect(infoRequest()).toEqual({ url: '-/info', baseURL: '/' })
  })
})

// The repository's id is the route parameter, percent-decoded by the router:
// `<fp>%2F-%2Faccess%2Fset%3Fsubject%3D...%23` made the owner's page GET
// `<fp>/-/access/set?subject=...` with its token, granting write access.
describe('repository action prefix', () => {
  const ENTITY = '1sfEACmTnQhBVgquGhaCs8Jw4SXKF9XY2apnUwJ63duq2QSxh5'

  function thrown(run: () => unknown): unknown {
    try {
      run()
    } catch (error) {
      return error
    }
    return undefined
  }

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('is under the app path for a fingerprint, an entity id or a route path', () => {
    window.history.replaceState(null, '', '/repositories/va7kZSfKM')
    expect(repoBasePath('va7kZSfKM')).toBe('/repositories/va7kZSfKM/-/')
    expect(repoBasePath(ENTITY)).toBe(`/repositories/${ENTITY}/-/`)
    expect(repoBasePath('va7-kZS-fKM')).toBe('/repositories/va7-kZS-fKM/-/')
  })

  it('is at the domain root on a domain route', () => {
    chatRoute()
    expect(repoBasePath('chat')).toBe('/chat/-/')
  })

  it.each([
    [
      'a climb to grant access',
      'va7kZSfKM/-/access/set?subject=x&permission=write#',
    ],
    ['a climb to delete', 'va7kZSfKM/-/delete#'],
    ['a backslash climb', 'va7kZSfKM\\-\\delete'],
    ['a query', 'va7kZSfKM?x='],
    ['two dots', '..'],
    ['the separator', '-'],
    ['nothing', ''],
  ])('is not found for %s', (_name, repoId) => {
    expect(isNotFound(thrown(() => repoBasePath(repoId)))).toBe(true)
  })
})
