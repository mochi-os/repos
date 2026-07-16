// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
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
  toastAction,
  Skeleton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  useFormat,
  useAuthStore,
  getRouterBasepath,
  isDomainEntityRouting,
} from '@mochi/web'
import {
  Code,
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
  ArrowLeft,
  Key,
} from 'lucide-react'
import { reposRequest } from '@/api/request'

interface TokenGetResponse {
  token: string
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
  repoPath: string
  fingerprint: string
}

type DialogView = 'loading' | 'clone' | 'manage' | 'create'

export function CloneDialog({ repoPath, fingerprint }: CloneDialogProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<DialogView>('loading')
  const [cloneCommand, setCloneCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [deleteHash, setDeleteHash] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const buildCloneUrl = (token: string | null) => {
    let path: string
    if (isDomainEntityRouting()) {
      // Domain-routed entities serve git at the entity root (special-cased in web_action).
      path = getRouterBasepath().replace(/\/$/, '')
    } else {
      // Path-routed: /<app>/<fingerprint>/git, or /<fingerprint>/git under direct
      // entity routing. The fingerprint is the entity route param, not part of the
      // router basepath (which resolves only to the app root), so it must be
      // spliced in explicitly here.
      const first = window.location.pathname.match(/^\/([^/]+)/)?.[1] || ''
      const direct = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(first)
      path = direct ? `/${fingerprint}/git` : `/${first}/${fingerprint}/git`
    }
    const url = new URL(`${window.location.origin}${path}`)
    if (token) {
      url.username = 'none'
      url.password = token
    }
    // git clone command — git literal, never translated.
    // eslint-disable-next-line lingui/no-unlocalized-strings
    return `git clone ${url.toString()} ${repoPath || 'repo'}`
  }

  const { data: tokensData, isLoading: tokensLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: async () => {
      return await reposRequest.get<TokenListResponse>('token/list')
    },
    enabled: open && view === 'manage',
  })

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return await reposRequest.post<TokenCreateResponse>(
        'token/create',
        { name }
      )
    },
    onSuccess: (data) => {
      setNewToken(data.token)
      setNewTokenName('')
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (hash: string) => {
      await reposRequest.post('token/delete', { hash })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
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
    // Anonymous viewers get a credential-less public clone URL
    if (!isAuthenticated) {
      setCloneCommand(buildCloneUrl(null))
      setView('clone')
      return
    }
    // Fetch token status on open
    setView('loading')
    try {
      const response = await reposRequest.post<TokenGetResponse>(
        'token/create',
        { name: repoPath || 'repo' }
      )
      setCloneCommand(buildCloneUrl(response.token))
      setView('clone')
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to get token`))
      setOpen(false)
    }
  }

  const handleCopy = () => {
    if (cloneCommand) {
      navigator.clipboard.writeText(cloneCommand)
      setCopied(true)
      toast.success(t`Copied to clipboard`)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyNewToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(buildCloneUrl(newToken))
      setCopied(true)
      toast.success(t`Copied to clipboard`)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCreate = async () => {
    if (!newTokenName.trim()) {
      toast.error(t`Please enter a token name`)
      return
    }
    try {
      await toastAction(createMutation.mutateAsync(newTokenName.trim()), {
        loading: t`Creating token...`,
        success: false,
        error: (e) => getErrorMessage(e, t`Failed to create token`),
      })
    } catch {
      // toast already shown
    }
  }

  const handleDelete = async () => {
    if (!deleteHash) return
    try {
      await toastAction(deleteMutation.mutateAsync(deleteHash), {
        loading: t`Deleting token...`,
        success: t`Token deleted`,
        error: (e) => getErrorMessage(e, t`Failed to delete token`),
      })
      setDeleteHash(null)
    } catch {
      // toast already shown
    }
  }

  const tokens = tokensData?.tokens || []

  const getTitle = () => {
    switch (view) {
      case 'manage':
        return t`Manage tokens`
      case 'create':
        return newToken ? t`Token created` : t`Create token`
      default:
        return t`Clone repository`
    }
  }

  const getDescription = () => {
    switch (view) {
      case 'manage':
        return null
      case 'create':
        return newToken
          ? t`Save this token now. You won't be able to see it again.`
          : t`Create a new authentication token.`
      default:
        return null
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpen}>
        <Button variant="outline" size="sm" onClick={() => handleOpen(true)}>
          <Code className="h-4 w-4" />
          <Trans>Clone</Trans>
        </Button>
        <DialogContent className="sm:max-w-4xl">
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
                <code className="flex-1 select-all overflow-x-auto whitespace-nowrap">{cloneCommand}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {isAuthenticated && (
                <p className="text-sm text-muted-foreground">
                  <Trans>Save this token securely. You won't be able to see it again.</Trans>
                </p>
              )}
              <DialogFooter className="flex-row gap-2 sm:justify-between">
                {isAuthenticated ? (
                  <Button variant="outline" onClick={() => setView('manage')}>
                    <Key className="h-4 w-4" />
                    <Trans>Manage tokens</Trans>
                  </Button>
                ) : <span />}
                <Button variant='outline' onClick={() => setOpen(false)}>
                  <Check className="h-4 w-4" />
                  <Trans>Done</Trans>
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
                  <Trans>No tokens yet.</Trans>
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
                          <Trans>Created {formatTimestamp(token.created, t`Never`)}</Trans>
                          {token.used ? <> · <Trans>Last used {formatTimestamp(token.used, t`Never`)}</Trans></> : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteHash(token.hash)}
                        disabled={deleteMutation.isPending}
                        aria-label={t`Delete token`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter className="flex-row gap-2 sm:justify-between">
                <Button variant="ghost" onClick={() => setView('clone')}>
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  <Trans>Back</Trans>
                </Button>
                <Button onClick={() => setView('create')}>
                  <Plus className="h-4 w-4" />
                  <Trans>Create token</Trans>
                </Button>
              </DialogFooter>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-4">
              {newToken ? (
                <>
                  <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm">
                    <code className="flex-1 select-all overflow-x-auto whitespace-nowrap">
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
                    <Trans>Save this token securely. You won't be able to see it again.</Trans>
                  </p>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        setNewToken(null)
                        setView('manage')
                      }}
                    >
                      <Check className="size-4" />
                      <Trans>Done</Trans>
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="token-name"><Trans>Token name</Trans></Label>
                    <Input
                      id="token-name"
                      placeholder={t`e.g., Work laptop`}
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCreate()
                      }}
                    />
                  </div>
                  <DialogFooter className="flex-row gap-2 sm:justify-between">
                    <Button variant="ghost" onClick={() => setView('manage')}>
                      <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                      <Trans>Back</Trans>
                    </Button>
                    <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
                      {createMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      <Trans>Create</Trans>
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
            <AlertDialogTitle><Trans>Delete token?</Trans></AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>This will permanently delete this token. Any git clients using it will
              no longer be able to authenticate.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Trans>Cancel</Trans></AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              <Trans>Delete</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
