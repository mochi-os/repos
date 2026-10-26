// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Link } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { Button } from '@mochi/web'
import { GitCompare } from 'lucide-react'

// Opens the compare page from the default branch to the branch being read,
// or with only the default branch chosen when that is the one being read.
export function CompareButton({
  fingerprint,
  base,
  head,
}: {
  fingerprint: string
  base: string
  head: string
}) {
  return (
    <Button variant='outline' asChild>
      <Link
        to='/$repoId/compare/$'
        params={{
          repoId: fingerprint,
          _splat: head && head !== base ? `${base}...${head}` : `${base}...`,
        }}
      >
        <GitCompare className='size-4' />
        <Trans>Compare</Trans>
      </Link>
    </Button>
  )
}
