import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  getErrorMessage,
  toast,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@mochi/common'
import {
  Download,
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
  ArrowLeft,
  Key,
} from 'lucide-react'
import { reposRequest, appBasePath } from '@/api/request'

interface TokenGetResponse {
  exists: boolean
  count?: number
  token?: string
}

interface TokenCreateResponse {
  token: string
}

interface Token {
  hash: string
  name: string
  created: number
  used: number
  expires: number
}

interface TokenListResponse {
  tokens: Token[]
}

interface CloneDialogProps {
  repoName: string
  fingerprint: string
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Never'
  return new Date(timestamp * 1000).toLocaleDateString()
}

type DialogView = 'loading' | 'clone' | 'existing' | 'manage' | 'create'

export function CloneDialog({ repoName, fingerprint }: CloneDialogProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<DialogView>('loading')
  const [cloneCommand, setCloneCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [deleteHash, setDeleteHash] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const buildCloneUrl = (token: string) => {
    const pathname = window.location.pathname
    const match = pathname.match(/^(\/[^/]+)\//)
    const appPrefix = match ? match[1] : ''
    const cloneUrl = `${window.location.origin}${appPrefix}/${fingerprint}/git`
    const url = new URL(cloneUrl)
    url.username = 'x'
    url.password = token
    return `git clone ${url.toString()}`
  }

  const { data: tokensData, isLoading: tokensLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: async () => {
      return await reposRequest.get<TokenListResponse>('token/list', {
        baseURL: appBasePath(),
      })
    },
    enabled: open && view === 'manage',
  })

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return await reposRequest.post<TokenCreateResponse>(
        'token/create',
        { name },
        { baseURL: appBasePath() }
      )
    },
    onSuccess: (data) => {
      setNewToken(data.token)
      setNewTokenName('')
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to create token'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (hash: string) => {
      await reposRequest.post('token/delete', { hash }, { baseURL: appBasePath() })
    },
    onSuccess: () => {
      toast.success('Token deleted')
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
      setDeleteHash(null)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete token'))
    },
  })

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset state when closing
      setView('loading')
      setCloneCommand(null)
      setCopied(false)
      setNewTokenName('')
      setNewToken(null)
      return
    }
    // Fetch token status on open
    setView('loading')
    try {
      const response = await reposRequest.post<TokenGetResponse>(
        'token/get',
        { name: repoName },
        { baseURL: appBasePath() }
      )
      if (response.exists) {
        setView('existing')
      } else if (response.token) {
        setCloneCommand(buildCloneUrl(response.token))
        setView('clone')
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to get token'))
      setOpen(false)
    }
  }

  const handleCopy = () => {
    if (cloneCommand) {
      navigator.clipboard.writeText(cloneCommand)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyNewToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(buildCloneUrl(newToken))
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCreate = () => {
    if (!newTokenName.trim()) {
      toast.error('Please enter a token name')
      return
    }
    createMutation.mutate(newTokenName.trim())
  }

  const tokens = tokensData?.tokens || []

  const getTitle = () => {
    switch (view) {
      case 'manage':
        return 'Manage tokens'
      case 'create':
        return newToken ? 'Token created' : 'Create token'
      default:
        return 'Clone repository'
    }
  }

  const getDescription = () => {
    switch (view) {
      case 'existing':
        return 'You already have authentication tokens. If you have previously cloned this repository, your existing credentials will work.'
      case 'manage':
        return null
      case 'create':
        return newToken
          ? 'Save this token now. You won\'t be able to see it again.'
          : 'Create a new authentication token.'
      default:
        return 'Copy this command to clone the repository.'
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpen}>
        <Button variant="outline" size="sm" onClick={() => handleOpen(true)}>
          <Download className="h-4 w-4" />
          Clone
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getTitle()}</DialogTitle>
            {getDescription() && (
              <DialogDescription>{getDescription()}</DialogDescription>
            )}
          </DialogHeader>

          {view === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {view === 'clone' && cloneCommand && (
            <div className="space-y-4">
              <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm">
                <code className="flex-1 break-all select-all">{cloneCommand}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Save this token securely. You won't be able to see it again.
              </p>
              <DialogFooter>
                <Button variant='outline' onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}

          {view === 'existing' && (
            <div className="space-y-4">
              <div className="bg-muted rounded-md p-3 font-mono text-sm">
                <code className="break-all select-all">
                  git clone {window.location.origin}/{fingerprint}/git
                </code>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setView('manage')}>
                  <Key className="h-4 w-4" />
                  Manage tokens
                </Button>
              </DialogFooter>
            </div>
          )}

          {view === 'manage' && (
            <div className="space-y-4">
              {tokensLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No tokens yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tokens.map((token) => (
                    <div
                      key={token.hash}
                      className="flex items-center justify-between p-3 rounded-md border"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{token.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {formatDate(token.created)}
                          {token.used ? ` · Last used ${formatDate(token.used)}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteHash(token.hash)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter className="flex-row gap-2 sm:justify-between">
                <Button variant="ghost" onClick={() => setView('existing')}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setView('create')}>
                  <Plus className="h-4 w-4" />
                  Create token
                </Button>
              </DialogFooter>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-4">
              {newToken ? (
                <>
                  <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm">
                    <code className="flex-1 break-all select-all">
                      {buildCloneUrl(newToken)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyNewToken}
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Save this token securely. You won't be able to see it again.
                  </p>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setNewToken(null)
                        setView('manage')
                      }}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="token-name">Token name</Label>
                    <Input
                      id="token-name"
                      placeholder="e.g., Work laptop"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate()
                      }}
                    />
                  </div>
                  <DialogFooter className="flex-row gap-2 sm:justify-between">
                    <Button variant="ghost" onClick={() => setView('manage')}>
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Create
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteHash} onOpenChange={() => setDeleteHash(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete token?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this token. Any git clients using it will
              no longer be able to authenticate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteHash && deleteMutation.mutate(deleteHash)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
