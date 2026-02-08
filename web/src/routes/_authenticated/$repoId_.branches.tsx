import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Main,
  Card,
  CardContent,
  Badge,
  Button,
  Skeleton,
  usePageTitle,
  GeneralError,
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
  toast,
  getErrorMessage,
} from '@mochi/common'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useBranches, useCreateBranch, useDeleteBranch } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/$repoId_/branches')({
  loader: async ({ params }) => {
    // Use window.location.pathname since TanStack Router's location is relative to app mount
    const pathname = window.location.pathname
    const firstSegment = pathname.match(/^\/([^/]+)/)?.[1] || ''
    const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment)
    const baseURL = isEntityContext
      ? `/${params.repoId}/-/`
      : `/${firstSegment}/${params.repoId}/-/`
    const info = await reposRequest.get<InfoResponse>('info', { baseURL })
    return { ...info, repoId: params.repoId }
  },
  component: BranchesPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function BranchesPage() {
  const data = Route.useLoaderData()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [sourceBranch, setSourceBranch] = useState('')

  const { data: branchesData } = useBranches(data.repoId)
  const branches = branchesData?.branches || []
  const defaultBranch = branchesData?.default || 'main'

  const createBranch = useCreateBranch(data.repoId)
  const deleteBranch = useDeleteBranch(data.repoId)

  usePageTitle(`${data.name} branches`)

  const handleCreate = () => {
    if (!newBranchName.trim()) {
      toast.error('Branch name is required')
      return
    }
    createBranch.mutate(
      { name: newBranchName.trim(), source: sourceBranch || defaultBranch },
      {
        onSuccess: () => {
          toast.success(`Branch "${newBranchName}" created`)
          setShowCreateDialog(false)
          setNewBranchName('')
          setSourceBranch('')
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to create branch'))
        },
      }
    )
  }

  const handleDeleteClick = (name: string) => {
    setBranchToDelete(name)
    setShowDeleteDialog(true)
  }

  const handleDelete = () => {
    deleteBranch.mutate(branchToDelete, {
      onSuccess: () => {
        toast.success(`Branch "${branchToDelete}" deleted`)
        setShowDeleteDialog(false)
        setBranchToDelete('')
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to delete branch'))
      },
    })
  }

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || 'Repository'}
          path={data.path || ''}
          description={data.description}
          activeTab="branches"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />
        {data.isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Create branch
            </Button>
          </div>
        )}
        <BranchesList
          repoId={data.repoId}
          defaultBranch={defaultBranch}
          isAdmin={data.isAdmin}
          onDelete={handleDeleteClick}
        />
      </div>

      {/* Create branch dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input
                id="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/my-feature"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Source branch</Label>
              <Select value={sourceBranch || defaultBranch} onValueChange={setSourceBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source branch" />
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
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newBranchName.trim() || createBranch.isPending}>
              {createBranch.isPending ? 'Creating...' : <><Plus className="h-4 w-4 mr-2" />Create branch</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete branch?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{branchToDelete}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteBranch.isPending}>
              {deleteBranch.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Main>
  )
}

interface BranchesListProps {
  repoId: string
  defaultBranch: string
  isAdmin?: boolean
  onDelete: (name: string) => void
}

function BranchesList({ repoId, defaultBranch, isAdmin, onDelete }: BranchesListProps) {
  const { data, isLoading, error } = useBranches(repoId)

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {error instanceof Error ? error.message : 'Failed to load branches'}
      </div>
    )
  }

  const branches = data?.branches || []

  if (branches.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No branches yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Card>
        <CardContent className="p-0 divide-y">
          {branches.map((branch) => (
            <div
              key={branch.name}
              className="flex items-center gap-4 p-4 hover:bg-accent transition-colors"
            >
              <Link
                to="/$repoId/tree/$ref/$"
                params={{ repoId, ref: branch.name, _splat: '' }}
                className="flex items-center gap-4 flex-1 min-w-0"
              >
                <GitBranch className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{branch.name}</span>
                    {branch.name === defaultBranch && (
                      <Badge variant="secondary">default</Badge>
                    )}
                  </div>
                </div>
              </Link>
              <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                {branch.sha.substring(0, 7)}
              </code>
              {isAdmin && (
                branch.name !== defaultBranch ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault()
                      onDelete(branch.name)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="w-9" /> // Placeholder for alignment
                )
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
