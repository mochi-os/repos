import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Header,
  Main,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  usePageTitle,
  requestHelpers,
  getErrorMessage,
  getAppPath,
  GeneralError,
  toast,
} from '@mochi/common'
import { FolderGit2, Save, Trash2, AlertTriangle } from 'lucide-react'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { useBranches, repoKeys } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/settings')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.repo.info)
    return info
  },
  component: SettingsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function SettingsPage() {
  const data = Route.useLoaderData()

  usePageTitle(`Settings - ${data.name}`)

  if (!data.entity || !data.id) {
    return (
      <>
        <Header>
          <h1 className="text-lg font-semibold">Repository not found</h1>
        </Header>
        <Main>
          <div className="p-4 text-muted-foreground">
            This page requires a repository context.
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{data.name}</h1>
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

function SettingsForm({ data }: { data: InfoResponse }) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(data.description || '')
  const [defaultBranch, setDefaultBranch] = useState(data.default_branch || 'main')
  const [allowRead, setAllowRead] = useState(data.allow_read ?? true)
  const [isPublic, setIsPublic] = useState(data.privacy !== 'private')
  const [confirmDelete, setConfirmDelete] = useState('')

  const { data: branchesData } = useBranches(data.id!)
  const branches = branchesData?.branches || []

  const updateSettings = useMutation({
    mutationFn: (settings: {
      description?: string
      default_branch?: string
      allow_read?: string
      privacy?: string
    }) =>
      requestHelpers.post<{ success: boolean }>(
        endpoints.repo.settingsSet(data.id!),
        settings
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      toast.success('Settings saved')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to save settings'))
    },
  })

  const deleteRepo = useMutation({
    mutationFn: () =>
      requestHelpers.post<{ success: boolean }>(endpoints.repo.delete(data.id!)),
    onSuccess: () => {
      toast.success('Repository deleted')
      window.location.href = getAppPath()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete repository'))
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettings.mutate({
      description,
      default_branch: defaultBranch,
      allow_read: allowRead ? 'true' : 'false',
      privacy: isPublic ? 'public' : 'private',
    })
  }

  const handleDelete = () => {
    if (confirmDelete !== data.name) {
      toast.error('Please type the repository name to confirm deletion')
      return
    }
    deleteRepo.mutate()
  }

  return (
    <div className="space-y-6 p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic repository settings</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Repository name</Label>
              <Input id="name" value={data.name} disabled />
              <p className="text-sm text-muted-foreground">
                Repository names cannot be changed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_branch">Default branch</Label>
              <Select value={defaultBranch} onValueChange={setDefaultBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.length === 0 ? (
                    <SelectItem value={defaultBranch}>{defaultBranch}</SelectItem>
                  ) : (
                    branches.map((branch) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateSettings.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateSettings.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Control who can access this repository</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-[8px] border px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="allow_read">Allow anyone to read repository</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, anyone can clone and browse this repository
              </p>
            </div>
            <Switch
              id="allow_read"
              checked={allowRead}
              onCheckedChange={setAllowRead}
            />
          </div>
          <div className="flex items-center justify-between rounded-[8px] border px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="public">Allow anyone to search for repository</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, this repository appears in search results
              </p>
            </div>
            <Switch
              id="public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateSettings.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm_delete">
              Type <strong>{data.name}</strong> to confirm deletion
            </Label>
            <Input
              id="confirm_delete"
              placeholder={data.name}
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmDelete !== data.name || deleteRepo.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleteRepo.isPending ? 'Deleting...' : 'Delete repository'}
          </Button>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the repository and all its data. This action cannot be undone.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
