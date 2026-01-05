import { useState, useCallback, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
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
  cn,
  AccessDialog,
  AccessList,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  type AccessLevel,
  type AccessRule,
} from '@mochi/common'
import { Plus, Save, Settings, Shield, Trash2 } from 'lucide-react'
import { reposRequest } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { useBranches, repoKeys } from '@/hooks/use-repository'
import { RepositoryHeader } from '@/features/repository/repository-header'

type SettingsTabId = 'general' | 'access'

type SettingsSearch = {
  tab?: SettingsTabId
}

export const Route = createFileRoute('/_authenticated/$repoId_/settings')({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: (search.tab === 'general' || search.tab === 'access') ? search.tab : undefined,
  }),
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
  component: SettingsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

interface SettingsTab {
  id: SettingsTabId
  label: string
  icon: React.ReactNode
}

const settingsTabs: SettingsTab[] = [
  { id: 'general', label: 'General', icon: <Settings className="h-4 w-4" /> },
  { id: 'access', label: 'Access', icon: <Shield className="h-4 w-4" /> },
]

const REPO_ACCESS_LEVELS: AccessLevel[] = [
  { value: 'write', label: 'Read and write' },
  { value: 'read', label: 'Read only' },
  { value: 'none', label: 'No access' },
]

function SettingsPage() {
  const data = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const activeSettingsTab = tab ?? 'general'

  const setActiveSettingsTab = (newTab: SettingsTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  usePageTitle(`${data.name} settings`)

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab={activeSettingsTab === 'access' ? 'access' : 'settings'}
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />

        {/* Settings sub-tabs - only show for admins */}
        {data.isAdmin && (
          <div className="flex gap-1 border-b">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                  'border-b-2 -mb-px',
                  activeSettingsTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <div className="pt-2">
          {activeSettingsTab === 'general' && <SettingsForm data={data} />}
          {activeSettingsTab === 'access' && data.isAdmin && <AccessTab repoId={data.repoId} />}
        </div>
      </div>
    </Main>
  )
}

function SettingsForm({ data }: { data: InfoResponse & { repoId: string } }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(data.description || '')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const { data: branchesData } = useBranches(data.repoId)
  const branches = branchesData?.branches || []

  const [isSaving, setIsSaving] = useState(false)

  const saveSettings = async (settings: Record<string, string>) => {
    setIsSaving(true)
    try {
      await reposRequest.post<{ success: boolean }>(
        endpoints.repo.settingsSet,
        settings,
        { baseURL: `/${data.repoId}/-/` }
      )
      toast.success('Settings saved')
      void queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save setting'))
    } finally {
      setIsSaving(false)
    }
  }

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
    void saveSettings({ default_branch: value })
  }

  const handleDelete = () => {
    deleteRepo.mutate()
  }

  return (
    <div className="p-4 max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <span className="text-muted-foreground">Name:</span>
            <span>{data.name}</span>
            <span className="text-muted-foreground">Entity:</span>
            <span className="font-mono break-all text-xs">{data.id || data.repoId}</span>
            <span className="text-muted-foreground">Fingerprint:</span>
            <span className="font-mono break-all text-xs">
              {(data.fingerprint || data.repoId)?.match(/.{1,3}/g)?.join('-')}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              onClick={() => void saveSettings({ description })}
              disabled={isSaving || description === (data.description || '')}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>

          {branches.length > 0 && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Default branch</Label>
                <p className="text-sm text-muted-foreground">The branch shown when viewing the repository</p>
              </div>
              <div className="w-full sm:w-48">
                <Select
                  value={data.default_branch || 'main'}
                  onValueChange={handleBranchChange}
                  disabled={isSaving}
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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        </CardContent>
      </Card>

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

function AccessTab({ repoId }: { repoId: string }) {
  const [rules, setRules] = useState<AccessRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // User search - use class-level endpoint
  const { data: userSearchData, isLoading: userSearchLoading } = useQuery({
    queryKey: ['users', 'search', userSearchQuery],
    queryFn: () => reposRequest.get<{ results: Array<{ id: string; name: string }> }>(
      `${endpoints.users.search}?q=${encodeURIComponent(userSearchQuery)}`,
      { baseURL: '/repositories/' }
    ),
    enabled: userSearchQuery.length >= 1,
  })

  // Groups - use class-level endpoint
  const { data: groupsData } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => reposRequest.get<{ groups: Array<{ id: string; name: string }> }>(
      endpoints.groups.list,
      { baseURL: '/repositories/' }
    ),
  })

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await reposRequest.get<{ rules: AccessRule[] }>(
        endpoints.repo.access,
        { baseURL: `/${repoId}/-/` }
      )
      setRules(response.rules ?? [])
    } catch (err) {
      console.error('[AccessTab] Failed to load rules', err)
      setError(err instanceof Error ? err : new Error('Failed to load access rules'))
    } finally {
      setIsLoading(false)
    }
  }, [repoId])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleAdd = async (subject: string, subjectName: string, operation: string) => {
    try {
      await reposRequest.post(
        endpoints.repo.accessSet,
        { subject, permission: operation },
        { baseURL: `/${repoId}/-/` }
      )
      toast.success(`Access set for ${subjectName}`)
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to set access level', err)
      toast.error(getErrorMessage(err, 'Failed to set access level'))
      throw err
    }
  }

  const handleRevoke = async (subject: string) => {
    try {
      await reposRequest.post(
        endpoints.repo.accessRevoke,
        { subject },
        { baseURL: `/${repoId}/-/` }
      )
      toast.success('Access removed')
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to revoke access', err)
      toast.error(getErrorMessage(err, 'Failed to remove access'))
    }
  }

  const handleLevelChange = async (subject: string, operation: string) => {
    try {
      await reposRequest.post(
        endpoints.repo.accessSet,
        { subject, permission: operation },
        { baseURL: `/${repoId}/-/` }
      )
      toast.success('Access level updated')
      void loadRules()
    } catch (err) {
      console.error('[AccessTab] Failed to update access level', err)
      toast.error(getErrorMessage(err, 'Failed to update access level'))
    }
  }

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <AccessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAdd}
        levels={REPO_ACCESS_LEVELS}
        defaultLevel="read"
        userSearchResults={userSearchData?.results ?? []}
        userSearchLoading={userSearchLoading}
        onUserSearch={setUserSearchQuery}
        groups={groupsData?.groups ?? []}
      />

      <AccessList
        rules={rules}
        levels={REPO_ACCESS_LEVELS}
        onLevelChange={handleLevelChange}
        onRevoke={handleRevoke}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}
