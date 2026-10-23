// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useLingui } from '@lingui/react/macro'
import {
  cn,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@mochi/web'
import { GitBranch } from 'lucide-react'

interface RefSelectorProps {
  branches: { name: string }[]
  // Offered too where a tag is as good a choice as a branch, as when comparing.
  tags?: { name: string }[]
  value: string
  onValueChange: (value: string) => void
  // What the picker chooses, for a screen reader, where it is not the branch
  // being browsed.
  label?: string
  className?: string
}

// Shared branch/ref switcher used across the Files, Commits, blob, and tree views.
// Replaces four near-identical inline `<Select>` blocks (each hard-coding w-[180px])
// so width, the GitBranch affordance, and the accessible label stay consistent and
// track the theme's control sizing.
export function RefSelector({
  branches,
  tags,
  value,
  onValueChange,
  label,
  className,
}: RefSelectorProps) {
  const { t } = useLingui()
  // Surface the current ref even when it isn't a listed branch or tag (e.g. a
  // commit sha), so the trigger never renders empty.
  const hasCurrent =
    !value ||
    branches.some((b) => b.name === value) ||
    !!tags?.some((tag) => tag.name === value)
  const shown = /^[0-9a-f]{40}$/i.test(value) ? value.substring(0, 7) : value
  // A tag named like a branch would give the list two entries with one value;
  // the name already picks the branch.
  const listed = (tags ?? []).filter(
    (tag) => !branches.some((branch) => branch.name === tag.name)
  )

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn('w-48', className)}
        aria-label={label ?? t`Switch branch`}
      >
        <GitBranch className='me-2 h-4 w-4' />
        <SelectValue
          className='flex-1 text-start'
          placeholder={t`Select branch`}
        />
      </SelectTrigger>
      <SelectContent>
        {!hasCurrent && (
          <SelectItem value={value} disabled>
            <span className='font-mono'>{shown}</span>
          </SelectItem>
        )}
        {listed.length > 0 ? (
          <>
            <SelectGroup>
              <SelectLabel>{t`Branches`}</SelectLabel>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>
                {t({ message: 'Tags', context: 'git tags' })}
              </SelectLabel>
              {listed.map((tag) => (
                <SelectItem key={`tag:${tag.name}`} value={tag.name}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : (
          branches.map((branch) => (
            <SelectItem key={branch.name} value={branch.name}>
              {branch.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
