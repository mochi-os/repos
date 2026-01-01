import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FolderGit2, Plus } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Switch,
  usePageTitle,
  Header,
  Main,
  getErrorMessage,
  toast,
} from '@mochi/common'
import { useCreateRepo } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/new')({
  component: NewRepositoryPage,
})

function NewRepositoryPage() {
  usePageTitle('New repository')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [allowRead, setAllowRead] = useState(true)
  const [isPublic, setIsPublic] = useState(true)

  const createRepo = useCreateRepo()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Repository name is required')
      return
    }

    if (name.trim().length > 100) {
      toast.error('Repository name is too long (max 100 characters)')
      return
    }

    createRepo.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        allow_read: allowRead ? 'true' : 'false',
        privacy: isPublic ? 'public' : 'private',
      },
      {
        onSuccess: (response) => {
          toast.success('Repository created')
          // Navigate to the new repository using SPA navigation
          if (response?.fingerprint) {
            void navigate({ to: '/$repoId', params: { repoId: response.fingerprint } })
          } else {
            void navigate({ to: '/' })
          }
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to create repository'))
        },
      }
    )
  }

  const handleCancel = () => {
    navigate({ to: '/' })
  }

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          <h1 className="text-lg font-semibold">New repository</h1>
        </div>
      </Header>
      <Main>
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5" />
                New repository
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Repository name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-[8px] border px-4 py-3">
                    <Label htmlFor="allow_read" className="text-sm font-medium">
                      Allow anyone to read repository
                    </Label>
                    <Switch
                      id="allow_read"
                      checked={allowRead}
                      onCheckedChange={setAllowRead}
                      disabled={createRepo.isPending}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-[8px] border px-4 py-3">
                    <Label htmlFor="public" className="text-sm font-medium">
                      Allow anyone to search for repository
                    </Label>
                    <Switch
                      id="public"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                      disabled={createRepo.isPending}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={createRepo.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!name.trim() || createRepo.isPending}>
                    <Plus className="h-4 w-4" />
                    {createRepo.isPending ? 'Creating repository...' : 'Create repository'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
