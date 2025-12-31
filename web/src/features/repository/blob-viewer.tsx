import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  Button,
  Skeleton,
} from '@mochi/common'
import {
  File,
  ChevronRight,
  Copy,
  Check,
  Download,
  FileCode,
} from 'lucide-react'
import { useState } from 'react'
import { useBlob } from '@/hooks/use-repository'

interface BlobViewerProps {
  repoId: string
  fingerprint: string
  ref: string
  path: string
  name: string
}

export function BlobViewer({ repoId, fingerprint, ref, path, name }: BlobViewerProps) {
  const { data, isLoading, error } = useBlob(repoId, ref, path)
  const [copied, setCopied] = useState(false)

  const pathParts = path.split('/').filter(Boolean)
  const fileName = pathParts[pathParts.length - 1] || 'file'

  const handleCopy = () => {
    if (data?.content) {
      navigator.clipboard.writeText(data.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (data?.content) {
      const blob = new Blob([data.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {error instanceof Error ? error.message : 'Failed to load file'}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 text-muted-foreground">File not found</div>
    )
  }

  const lines = data.content?.split('\n') || []
  const language = getLanguageFromFileName(fileName)

  return (
    <div className="space-y-4 p-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <Link to="/$repoId" params={{ repoId: fingerprint }} className="text-primary hover:underline">
          {name}
        </Link>
        {pathParts.map((part, index) => {
          const pathTo = pathParts.slice(0, index + 1).join('/')
          const isLast = index === pathParts.length - 1
          return (
            <span key={pathTo} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {isLast ? (
                <span className="font-medium">{part}</span>
              ) : (
                <Link
                  to="/$repoId/tree/$ref/$"
                  params={{ repoId: fingerprint, ref, _splat: pathTo }}
                  className="text-primary hover:underline"
                >
                  {part}
                </Link>
              )}
            </span>
          )
        })}
      </div>

      {/* File content */}
      <Card>
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-2 text-sm">
            <FileCode className="h-4 w-4" />
            <span>{fileName}</span>
            <span className="text-muted-foreground">
              {formatFileSize(data.size)} · {lines.length} lines
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!data.binary && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {data.binary ? (
            <div className="p-8 text-center text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-2" />
              <p>Binary file ({formatFileSize(data.size)})</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <pre className="text-sm">
                <code className={language ? `language-${language}` : ''}>
                  <table className="w-full border-collapse">
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index} className="hover:bg-accent/50">
                          <td className="px-4 py-0 text-right text-muted-foreground select-none border-r w-12 align-top">
                            {index + 1}
                          </td>
                          <td className="px-4 py-0 whitespace-pre">{line || ' '}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </code>
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getLanguageFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'fish',
    ps1: 'powershell',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    markdown: 'markdown',
    txt: 'text',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'nginx',
    vim: 'vim',
    lua: 'lua',
    r: 'r',
    m: 'matlab',
    pl: 'perl',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    hrl: 'erlang',
    clj: 'clojure',
    hs: 'haskell',
    ml: 'ocaml',
    fs: 'fsharp',
    elm: 'elm',
    vue: 'vue',
    svelte: 'svelte',
    astro: 'astro',
  }
  return ext ? languageMap[ext] || null : null
}
