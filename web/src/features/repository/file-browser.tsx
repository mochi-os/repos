// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Card,
  CardContent,
  Skeleton,
  getErrorMessage,
  naturalCompare,
} from '@mochi/web'
import { ChevronRight } from 'lucide-react'
import type { TreeEntry } from '@/api/types'
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
  const navigate = useNavigate()
  const [currentRef, setCurrentRef] = useState(initialRef || defaultBranch)
  const [currentPath, setCurrentPath] = useState(initialPath)

  // Navigate rather than only setting state, as the blob viewer does: without
  // this the tree re-renders on the new branch while the URL still names the
  // old one, so a reload or a shared link shows something else.
  const handleBranchChange = (newRef: string) => {
    setCurrentRef(newRef)
    navigate({
      to: '/$repoId/tree/$ref/$',
      params: { repoId: fingerprint, ref: newRef, _splat: currentPath },
    })
  }

  // Sync from props when URL changes (useState only uses initial value on mount)
  useEffect(() => {
    setCurrentRef(initialRef || defaultBranch)
  }, [initialRef, defaultBranch])
  useEffect(() => {
    setCurrentPath(initialPath)
  }, [initialPath])

  const { data: branchesData } = useBranches(repoId)
  const {
    data: treeData,
    isLoading: treeLoading,
    error,
  } = useTree(repoId, currentRef, currentPath)

  // Sync ref and path from API response (handles branch names with slashes)
  useEffect(() => {
    if (treeData) {
      if (treeData.ref && treeData.ref !== currentRef)
        setCurrentRef(treeData.ref)
      if (treeData.path !== undefined && treeData.path !== currentPath)
        setCurrentPath(treeData.path)
    }
  }, [treeData, currentRef, currentPath])

  const branches = branchesData?.branches || []
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <div className='space-y-4'>
      {/* Branch selector */}
      {branches.length > 0 && (
        <RefSelector
          branches={branches}
          value={currentRef}
          onValueChange={handleBranchChange}
        />
      )}

      {/* Breadcrumb */}
      {pathParts.length > 0 && (
        <div className='flex items-center gap-1 text-sm'>
          <Link
            to='/$repoId/tree/$ref/$'
            params={{ repoId: fingerprint, ref: currentRef, _splat: '' }}
            className='text-primary hover:underline'
          >
            {name}
          </Link>
          {pathParts.map((part, index) => {
            const pathTo = pathParts.slice(0, index + 1).join('/')
            return (
              <span key={pathTo} className='flex items-center gap-1'>
                <ChevronRight className='text-muted-foreground h-4 w-4 rtl:rotate-180' />
                {index === pathParts.length - 1 ? (
                  <span>{part}</span>
                ) : (
                  <Link
                    to='/$repoId/tree/$ref/$'
                    params={{
                      repoId: fingerprint,
                      ref: currentRef,
                      _splat: pathTo,
                    }}
                    className='text-primary hover:underline'
                  >
                    {part}
                  </Link>
                )}
              </span>
            )
          })}
        </div>
      )}

      <FileListing
        fingerprint={fingerprint}
        currentRef={currentRef}
        currentPath={currentPath}
        entries={treeData?.entries || []}
        isLoading={treeLoading}
        error={error}
      />
    </div>
  )
}

interface FileListingProps {
  fingerprint: string
  currentRef: string
  currentPath: string
  entries: TreeEntry[]
  isLoading: boolean
  error: Error | null
}

// The entries of one tree, directories first. Shared by the Files tab and the
// /tree page so the two cannot drift apart.
export function FileListing({
  fingerprint,
  currentRef,
  currentPath,
  entries,
  isLoading,
  error,
}: FileListingProps) {
  const { t } = useLingui()

  // The server sends "dir"; "tree" is git's own word for the same thing and
  // appears in some responses, so both count.
  const sortedEntries = [...entries].sort((a, b) => {
    const aIsDir = a.type === 'tree' || a.type === 'dir'
    const bIsDir = b.type === 'tree' || b.type === 'dir'
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    return naturalCompare(a.name, b.name)
  })

  return (
    <Card>
      <CardContent className='p-0'>
        {isLoading ? (
          <div className='space-y-2 p-4'>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : error ? (
          <div className='text-destructive p-4'>
            {getErrorMessage(error, t`Failed to load files`)}
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className='text-muted-foreground p-8 text-center'>
            {currentPath ? (
              <Trans>Empty directory</Trans>
            ) : (
              <Trans>Empty repository</Trans>
            )}
          </div>
        ) : (
          <div className='divide-y'>
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
  )
}
