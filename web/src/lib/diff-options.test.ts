// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import {
  commitSearch,
  compareRange,
  compareSearch,
  diffOptions,
  pickedRange,
  shortRef,
} from '@/lib/diff-options'

const sha = 'a'.repeat(40)

describe('compareRange', () => {
  it('splits the address at its three dots', () => {
    expect(compareRange('main...feature', 'main')).toEqual({
      base: 'main',
      head: 'feature',
    })
  })

  it('keeps the slashes of branch names', () => {
    expect(compareRange('release/1.0...feature/login', 'main')).toEqual({
      base: 'release/1.0',
      head: 'feature/login',
    })
  })

  it('names only a base when there are no dots', () => {
    expect(compareRange('develop', 'main')).toEqual({
      base: 'develop',
      head: '',
    })
  })

  it('falls back to the default branch for an empty base', () => {
    expect(compareRange(undefined, 'main')).toEqual({ base: 'main', head: '' })
    expect(compareRange('...feature', 'main')).toEqual({
      base: 'main',
      head: 'feature',
    })
  })
})

describe('compareSearch', () => {
  it('keeps the direct mode and leaves the default out', () => {
    expect(compareSearch({ mode: 'direct' }).mode).toBe('direct')
    expect(compareSearch({ mode: 'diverged' }).mode).toBeUndefined()
    expect(compareSearch({ mode: 'sideways' }).mode).toBeUndefined()
  })

  it('keeps a path and drops an empty one', () => {
    expect(compareSearch({ path: 'src' }).path).toBe('src')
    expect(compareSearch({ path: '' }).path).toBeUndefined()
  })
})

describe('commitSearch', () => {
  it('keeps a parent only when it is a full commit hash', () => {
    expect(commitSearch({ parent: sha }).parent).toBe(sha)
    expect(commitSearch({ parent: 'main' }).parent).toBeUndefined()
    expect(commitSearch({ parent: sha.slice(0, 7) }).parent).toBeUndefined()
  })
})

describe('diffOptions', () => {
  it('reads the context steps whether the URL gave a number or text', () => {
    expect(diffOptions({ context: 10 }).context).toBe(10)
    expect(diffOptions({ context: '25' }).context).toBe(25)
    expect(diffOptions({ context: 'all' }).context).toBe('all')
  })

  it('leaves the server default and anything unknown out', () => {
    expect(diffOptions({ context: 3 }).context).toBeUndefined()
    expect(diffOptions({ context: 7 }).context).toBeUndefined()
    expect(diffOptions({ context: 'most' }).context).toBeUndefined()
  })

  it('reads ignoring whitespace', () => {
    expect(diffOptions({ whitespace: 'ignore' }).whitespace).toBe('ignore')
    expect(diffOptions({ whitespace: 'yes' }).whitespace).toBeUndefined()
  })
})

describe('shortRef', () => {
  it('shortens a commit hash and leaves a name as it is', () => {
    expect(shortRef(sha)).toBe('aaaaaaa')
    expect(shortRef('feature/login')).toBe('feature/login')
  })
})

describe('pickedRange', () => {
  const commits = [
    { sha: 'newest', date: 30 },
    { sha: 'middle', date: 20 },
    { sha: 'oldest', date: 10 },
  ]

  it('compares from the older pick to the newer, in either picking order', () => {
    expect(pickedRange(['newest', 'oldest'], commits)).toEqual({
      base: 'oldest',
      head: 'newest',
    })
    expect(pickedRange(['oldest', 'newest'], commits)).toEqual({
      base: 'oldest',
      head: 'newest',
    })
  })

  // A history walked after a merge: the branch's commit of the 3rd is listed
  // below the first commit of the 1st.
  it('reads older by date, not by place in the list', () => {
    const walked = [
      { sha: 'merge', date: 50 },
      { sha: 'first', date: 10 },
      { sha: 'feature', date: 30 },
    ]
    expect(pickedRange(['first', 'feature'], walked)).toEqual({
      base: 'first',
      head: 'feature',
    })
  })

  it('falls back to the list for commits of one moment', () => {
    const same = [
      { sha: 'later', date: 10 },
      { sha: 'earlier', date: 10 },
    ]
    expect(pickedRange(['later', 'earlier'], same)).toEqual({
      base: 'earlier',
      head: 'later',
    })
  })

  it('needs two picks', () => {
    expect(pickedRange(['middle'], commits)).toBeUndefined()
  })
})
