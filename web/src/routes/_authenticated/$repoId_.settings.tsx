import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Header,
  Main,
  Button,
  Label,
  Textarea,
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
  usePageTitle,
  getErrorMessage,
  GeneralError,
  toast,
} from '@mochi/common'
import { FolderGit2, Save, Trash2 } from 'lucide-react'
import { reposRequest } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { useBranches, repoKeys } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/$repoId_/settings')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>(
      'info',
      { baseURL: `/${params.repoId}/-/` }
    )
    return { ...info, repoId: params.repoId }
  },
  component: SettingsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function SettingsPage() {
  const data = Route.useLoaderData()

  usePageTitle(`${data.name} settings`)

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <Link to="/$repoId" params={{ repoId: data.repoId }} className="text-lg font-semibold hover:underline">
            {data.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span>Settings</span>
        </div>
      </Header>
      <Main>
        <SettingsForm data={data} />
      </Main>
    </>
  )
}

function SettingsForm({ data }: { data: InfoResponse & { repoId: string } }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(data.description || '')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const { data: branchesData } = useBranches(data.repoId)
  const branches = branchesData?.branches || []

  const updateSetting = useMutation({
    mutationFn: (settings: Record<string, string>) =>
      reposRequest.post<{ success: boolean }>(
        endpoints.repo.settingsSet,
        settings,
        { baseURL: `/${data.repoId}/-/` }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to save setting'))
    },
  })

  const deleteRepo = useMutation({
    mutationFn: () =>
      reposRequest.post<{ success: boolean }>(
        endpoints.repo.delete,
        undefined,
        { baseURL: `/${data.repoId}/-/` }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      toast.success('Repository deleted')
      void navigate({ to: '/' })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete repository'))
    },
  })

  const handleBranchChange = (value: string) => {
    updateSetting.mutate({ default_branch: value })
  }

  const handleDelete = () => {
    deleteRepo.mutate()
  }

  return (
    <div className="divide-y p-4 max-w-2xl">
      <div className="space-y-2 py-4">
        <Label className="text-base">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <Button
          size="sm"
          onClick={() => updateSetting.mutate({ description })}
          disabled={updateSetting.isPending || description === (data.description || '')}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      {branches.length > 0 && (
        <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Default branch</Label>
            <p className="text-sm text-muted-foreground">The branch shown when viewing the repository</p>
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={data.default_branch || 'main'}
              onValueChange={handleBranchChange}
              disabled={updateSetting.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <Label className="text-base">Delete repository</Label>
          <p className="text-sm text-muted-foreground">
            Permanently delete this repository and all its data
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowDeleteDialog(true)}
          disabled={deleteRepo.isPending}
        >
          <Trash2 className="h-4 w-4" />
          Delete repository
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete repository?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{data.name}" and all its commits, branches, and
              tags. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
