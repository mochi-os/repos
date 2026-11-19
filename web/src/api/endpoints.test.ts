// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import endpoints, { encodeRef } from './endpoints'

describe('encodeRef', () => {
  it('keeps the slashes of a ref or path and escapes the rest', () => {
    expect(encodeRef('feature/one')).toBe('feature/one')
    expect(encodeRef('docs/a #b?.md')).toBe('docs/a%20%23b%3F.md')
  })

  it('takes a folder address with a slash at either end', () => {
    expect(encodeRef('src/')).toBe('src')
    expect(encodeRef('/docs/a b/')).toBe('docs/a%20b')
  })

  it('refuses a component the URL would resolve away', () => {
    for (const value of [
      '..',
      '.',
      'main/../../delete',
      'a//b',
      '',
      '/',
      './a',
    ]) {
      expect(() => encodeRef(value)).toThrow()
    }
  })

  it('refuses a tree, blob or history link that would climb to another action', () => {
    expect(() => endpoints.repo.tree('main', '../../delete')).toThrow()
    expect(() => endpoints.repo.blob('..', 'delete')).toThrow()
    expect(() => endpoints.repo.history('main', '../../../delete')).toThrow()
    expect(endpoints.repo.blob('main', 'src/app.ts')).toBe(
      'blob/main/src/app.ts'
    )
  })
})

// A repository id or a commit is one segment, so it goes in through path: one
// holding `../delete`, a query or a slash would otherwise aim the request at
// another action. Core routes on the decoded path, so a slash is refused.
describe('single-segment endpoints', () => {
  const REFUSED = ['../delete', 'a/b', '.', '..', '']
  const SHA = '3f786850e387550fdab836ed7e6dc881de23001b'

  it('keeps a repository id or a commit as is', () => {
    expect(endpoints.repo.share('yUVSR7upX')).toBe('yUVSR7upX/-/share')
    expect(endpoints.repo.commit(SHA)).toBe(`commit/${SHA}`)
  })

  it('refuses a hostile repository id or commit', () => {
    for (const value of REFUSED) {
      expect(() => endpoints.repo.share(value)).toThrow()
      expect(() => endpoints.repo.commit(value)).toThrow()
    }
  })

  it('encodes a query in a commit into the one segment', () => {
    expect(endpoints.repo.commit('x?y=1')).toBe('commit/x%3Fy%3D1')
  })

  it('names a ref the way it did before', () => {
    expect(endpoints.repo.commits('feature/one')).toBe('commits/feature/one')
    expect(endpoints.repo.commits()).toBe('commits')
    expect(endpoints.repo.tree('main')).toBe('tree/main')
    expect(endpoints.repo.tree('main', 'src/a b.ts')).toBe(
      'tree/main/src/a%20b.ts'
    )
    expect(endpoints.repo.history('main', 'src/app.ts')).toBe(
      'history/main/src/app.ts'
    )
  })
})
