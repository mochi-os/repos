// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { i18n } from '@lingui/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { commitsHeading } from './compare-view'

beforeEach(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
})

describe("the heading over a comparison's commits", () => {
  it('counts a list shorter than a comparison lists', () => {
    expect(commitsHeading(Array(3).fill({}))).toBe('3 commits')
  })

  it('says a list at the most a comparison lists is the newest of them', () => {
    // The comparison stops at 1,000 commits, so a list that long may have
    // left older ones out: it must not read as the whole range.
    expect(commitsHeading(Array(1000).fill({}))).toBe(
      'The newest 1,000 commits'
    )
  })
})
