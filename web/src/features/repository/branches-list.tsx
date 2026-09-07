// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  Badge,
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  toast,
  toastAction,
  getErrorMessage,
} from '@mochi/web'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import { useBranches, useCreateBranch, useDeleteBranch } from '@/hooks/use-repository'
import { DownloadDropdown } from '@/components/download-dropdown'

interface BranchesListProps {
  repoId: string
  fingerprint: string
  defaultBranch: string
  // The owner creates and deletes; everyone else only browses.
  canManage?: boolean
}

// The branch list with its create and delete dialogs. Shared by the Branches
// tab and the /branches page so the two cannot drift apart.
export function BranchesList({ repoId, fingerprint, defaultBranch, canManage }: BranchesListProps) {
  const { t } = useLingui()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [sourceBranch, setSourceBranch] = useState('')

  const { data, isLoading, error } = useBranches(repoId)
  const createBranch = useCreateBranch(repoId)
  const deleteBranch = useDeleteBranch(repoId)

  const branches = data?.branches || []
  const actualDefault = data?.default || defaultBranch

  const handleCreate = async () => {
    if (!newBranchName.trim()) {
      toast.error(t`Branch name is required`)
      return
    }
    const name = newBranchName.trim()
    try {
      await toastAction(
        createBranch.mutateAsync({ name, source: sourceBranch || actualDefault }),
        {
          loading: t`Creating branch...`,
          success: t`Branch "${name}" created`,
          error: (e) => getErrorMessage(e, t`Failed to create branch`),
        }
      )
      setShowCreateDialog(false)
      setNewBranchName('')
      setSourceBranch('')
    } catch {
      // toast already shown
    }
  }

  const handleDeleteClick = (name: string) => {
    setBranchToDelete(name)
    setShowDeleteDialog(true)
  }

  const handleDelete = async () => {
    const name = branchToDelete
    try {
      await toastAction(deleteBranch.mutateAsync(name), {
        loading: t`Deleting branch...`,
        success: t`Branch "${name}" deleted`,
        error: (e) => getErrorMessage(e, t`Failed to delete branch`),
      })
      setShowDeleteDialog(false)
      setBranchToDelete('')
    } catch {
      // toast already shown
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, t`Failed to load branches`)}
      </div>
    )
  }

  return (
    <>
      {canManage && branches.length > 0 && (
        <div className="flex justify-end mb-2">
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            <Trans>Create branch</Trans>
          </Button>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p><Trans>No branches yet</Trans></p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {branches.map((branch) => (
              <div
                key={branch.name}
                className="flex items-center gap-4 p-4 hover:bg-hover transition-colors"
              >
                <Link
                  to="/$repoId/tree/$ref/$"
                  params={{ repoId: fingerprint, ref: branch.name, _splat: '' }}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <GitBranch className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{branch.name}</span>
                      {branch.name === actualDefault && (
                        <Badge variant="secondary"><Trans>default</Trans></Badge>
                      )}
                    </div>
                  </div>
                  <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                    {branch.sha.substring(0, 7)}
                  </code>
                </Link>
                <DownloadDropdown gitRef={branch.name} variant="icon" />
                {canManage && branch.name !== actualDefault && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault()
                          handleDeleteClick(branch.name)
                        }}
                        aria-label={t`Delete branch`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t`Delete branch`}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create branch dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><Trans>New branch</Trans></DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name"><Trans>Branch name</Trans></Label>
              <Input
                id="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder={t`feature/my-feature`}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label><Trans>Source branch</Trans></Label>
              <Select value={sourceBranch || actualDefault} onValueChange={setSourceBranch}>
                <SelectTrigger>
                  <SelectValue placeholder={t`Select source branch`} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button onClick={handleCreate} disabled={!newBranchName.trim() || createBranch.isPending}>
              {createBranch.isPending ? <Trans>Creating...</Trans> : <><Plus className="h-4 w-4 me-2" /><Trans>Create branch</Trans></>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><Trans>Delete branch?</Trans></AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>Delete "{branchToDelete}"? This cannot be undone.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Trans>Cancel</Trans></AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteBranch.isPending}>
              {deleteBranch.isPending ? <Trans>Deleting...</Trans> : <Trans>Delete</Trans>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
