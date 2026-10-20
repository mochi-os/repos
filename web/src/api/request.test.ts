// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { anonymousRefusal } from './request'

const path = vi.hoisted(() => ({ app: '/repositories', domain: false }))

vi.mock('@mochi/web', () => ({
  createAppClient: () => ({}),
  getAppPath: () => path.app,
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
})

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
