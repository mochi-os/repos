// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useEffect } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, Skeleton, getErrorMessage, naturalCompare } from '@mochi/web'
import { ChevronRight } from 'lucide-react'
import { useTree, useBranches } from '@/hooks/use-repository'

import { FileEntry } from '@/components/file-entry'
import { RefSelector } from '@/components/ref-selector'

interface FileTreeProps {
  repoId: string
  fingerprint: string
  name: string
  defaultBranch: string
  currentRef: string
  currentPath: string
}

export function FileTree({
  repoId,
  fingerprint,
  name,
  defaultBranch,
  currentRef: initialRef,
  currentPath: initialPath,
}: FileTreeProps) {
  const { t } = useLingui()
  const [currentRef, setCurrentRef] = useState(initialRef || defaultBranch)
  const [currentPath, setCurrentPath] = useState(initialPath)

  // Sync from props when URL changes (useState only uses initial value on mount)
  useEffect(() => { setCurrentRef(initialRef || defaultBranch) }, [initialRef, defaultBranch])
  useEffect(() => { setCurrentPath(initialPath) }, [initialPath])

  const { data: branchesData } = useBranches(repoId)
  const { data: treeData, isLoading: treeLoading, error } = useTree(repoId, currentRef, currentPath)

  // Sync ref and path from API response (handles branch names with slashes)
  useEffect(() => {
    if (treeData) {
      if (treeData.ref && treeData.ref !== currentRef) setCurrentRef(treeData.ref)
      if (treeData.path !== undefined && treeData.path !== currentPath) setCurrentPath(treeData.path)
    }
  }, [treeData?.ref, treeData?.path])

  const branches = branchesData?.branches || []
  const entries = treeData?.entries || []

  const sortedEntries = [...entries].sort((a, b) => {
    const aIsDir = a.type === 'tree' || a.type === 'dir'
    const bIsDir = b.type === 'tree' || b.type === 'dir'
    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return naturalCompare(a.name, b.name)
  })

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <div className="space-y-4">
      {/* Branch selector */}
      {branches.length > 0 && (
        <RefSelector branches={branches} value={currentRef} onValueChange={setCurrentRef} />
      )}

      {/* Breadcrumb */}
      {pathParts.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <Link
            to="/$repoId/tree/$ref/$"
            params={{ repoId: fingerprint, ref: currentRef, _splat: '' }}
            className="text-primary hover:underline"
          >
            {name}
          </Link>
          {pathParts.map((part, index) => {
            const pathTo = pathParts.slice(0, index + 1).join('/')
            return (
              <span key={pathTo} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                {index === pathParts.length - 1 ? (
                  <span>{part}</span>
                ) : (
                  <Link
                    to="/$repoId/tree/$ref/$"
                    params={{ repoId: fingerprint, ref: currentRef, _splat: pathTo }}
                    className="text-primary hover:underline"
                  >
                    {part}
                  </Link>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* File listing */}
      <Card>
        <CardContent className="p-0">
          {treeLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-destructive">
              {getErrorMessage(error, t`Failed to load files`)}
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Trans>Empty directory</Trans>
            </div>
          ) : (
            <div className="divide-y">
              {sortedEntries.map((entry) => (
                <FileEntry
                  key={entry.name}
                  entry={entry}
                  fingerprint={fingerprint}
                  currentRef={currentRef}
                  basePath={currentPath}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
