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
          console.log('Create response:', response)
          toast.success('Repository created')
          // Navigate to the new repository entity
          if (response?.url) {
            window.location.href = response.url
          } else {
            console.log('No URL in response, navigating to /')
            navigate({ to: '/' })
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
        <h1 className="text-lg font-semibold">Create repository</h1>
      </Header>
      <Main>
        <div className="container mx-auto max-w-lg p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5" />
                Create repository
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

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={createRepo.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRepo.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    {createRepo.isPending ? 'Creating...' : 'Create repository'}
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
