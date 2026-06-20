// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useLingui } from '@lingui/react/macro'
import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mochi/web'
import { GitBranch } from 'lucide-react'

interface RefSelectorProps {
  branches: { name: string }[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

// Shared branch/ref switcher used across the Files, Commits, blob, and tree views.
// Replaces four near-identical inline `<Select>` blocks (each hard-coding w-[180px])
// so width, the GitBranch affordance, and the accessible label stay consistent and
// track the theme's control sizing.
export function RefSelector({ branches, value, onValueChange, className }: RefSelectorProps) {
  const { t } = useLingui()
  // Surface the current ref even when it isn't a branch (e.g. a tag or commit sha),
  // so the trigger never renders empty.
  const hasCurrent = !value || branches.some((b) => b.name === value)

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn('w-48', className)} aria-label={t`Switch branch`}>
        <GitBranch className="h-4 w-4 me-2" />
        <SelectValue className="flex-1 text-start" placeholder={t`Select branch`} />
      </SelectTrigger>
      <SelectContent>
        {!hasCurrent && (
          <SelectItem value={value} disabled>
            {value}
          </SelectItem>
        )}
        {branches.map((branch) => (
          <SelectItem key={branch.name} value={branch.name}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
