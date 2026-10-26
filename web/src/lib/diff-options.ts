// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// The comparison options a diff page carries in its URL, so a link shows what
// its sender saw. Left out, each is the server's own comparison.
export interface DiffOptions {
  // Unchanged lines around each change, or the whole file.
  context?: number | 'all'
  whitespace?: 'ignore'
}

// The context steps offered, smallest first. 3 is what the server sends.
export const CONTEXTS = [3, 10, 25, 'all'] as const
export type Context = (typeof CONTEXTS)[number]
export const DEFAULT_CONTEXT = 3

// The diff options a URL's search holds, with anything unusable dropped.
export function diffOptions(search: Record<string, unknown>): DiffOptions {
  const value = search.context
  const context = CONTEXTS.find(
    (step) => step === value || String(step) === value
  )
  return {
    context:
      context === undefined || context === DEFAULT_CONTEXT
        ? undefined
        : context,
    whitespace: search.whitespace === 'ignore' ? 'ignore' : undefined,
  }
}

// A commit as a reader recognises it: a full hash shortened, a branch or tag
// as named.
export function shortRef(ref: string): string {
  return /^[0-9a-f]{40}$/i.test(ref) ? ref.substring(0, 7) : ref
}

// What a commit page carries in its URL: the parent its changes are compared
// with, a file or folder to limit them to, and the diff options.
export interface CommitSearch extends DiffOptions {
  parent?: string
  path?: string
}

export function commitSearch(search: Record<string, unknown>): CommitSearch {
  return {
    parent:
      typeof search.parent === 'string' && /^[0-9a-f]{40}$/i.test(search.parent)
        ? search.parent
        : undefined,
    path:
      typeof search.path === 'string' && search.path ? search.path : undefined,
    ...diffOptions(search),
  }
}

// What a compare page carries in its URL beside the two refs: how they are
// compared, a file or folder to limit the comparison to, and the diff options.
// Comparing from where the two split is the default and is left out.
export interface CompareSearch extends DiffOptions {
  mode?: 'direct'
  path?: string
}

export function compareSearch(search: Record<string, unknown>): CompareSearch {
  return {
    mode: search.mode === 'direct' ? 'direct' : undefined,
    path:
      typeof search.path === 'string' && search.path ? search.path : undefined,
    ...diffOptions(search),
  }
}

// The two refs a compare address names, as <base>...<head>. A ref cannot hold
// two dots in a row, so the first three mark the split. An address without
// them names only a base, and an empty base falls back to the default branch.
export function compareRange(
  splat: string | undefined,
  fallback: string
): { base: string; head: string } {
  const value = splat ?? ''
  const split = value.indexOf('...')
  if (split < 0) return { base: value || fallback, head: '' }
  return {
    base: value.slice(0, split) || fallback,
    head: value.slice(split + 3),
  }
}

// Two commits picked from a list, in the order a comparison reads them, older
// first. Older is by date: a list walks history, and after a merge it can name
// a branch's later commit below an earlier one on the other side. Commits of
// one moment fall back to the list, which is newest first.
export function pickedRange(
  picked: string[],
  commits: { sha: string; date: number }[]
): { base: string; head: string } | undefined {
  if (picked.length !== 2) return undefined
  const position = (sha: string) =>
    commits.findIndex((commit) => commit.sha === sha)
  const date = (sha: string) => commits[position(sha)]?.date ?? 0
  const [base, head] = [...picked].sort(
    (a, b) => date(a) - date(b) || position(b) - position(a)
  )
  return { base, head }
}
