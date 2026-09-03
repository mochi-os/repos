// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import type { AxiosRequestConfig } from 'axios'
import { createAppClient, getAppPath, isDomainEntityRouting, shellSaveBlob } from '@mochi/web'

const CLASS_ROUTES = ['new', 'settings']

function isEntityIdentifier(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(s)
}

export function appBasePath(): string {
  return `${getAppPath()}/`
}

export function repoBasePath(repoId: string): string {
  const firstSegment = window.location.pathname.match(/^\/([^/]+)/)?.[1] || ''
  const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment)
  return isEntityContext || isDomainEntityRouting()
    ? `/${repoId}/-/`
    : `/${firstSegment}/${repoId}/-/`
}

// Where a request goes when the caller names no base: the routed repository's
// action prefix when the page is inside one, else the app root.
export function computeApiBasepath(pathname: string = window.location.pathname): string {
  const directMatch = pathname.match(/^\/([^/]+)/)
  if (directMatch && isEntityIdentifier(directMatch[1])) {
    return `/${directMatch[1]}/-/`
  }

  const match = pathname.match(/^(\/[^/]+)\/([^/]+)/)
  if (match && !CLASS_ROUTES.includes(match[2]) && isEntityIdentifier(match[2])) {
    return `${match[1]}/${match[2]}/-/`
  }

  if (directMatch && isDomainEntityRouting()) {
    return `/${directMatch[1]}/-/`
  }

  if (directMatch) {
    return `/${directMatch[1]}/`
  }

  return '/'
}

// The shared client supplies what every app needs: the bearer token gated on
// the request origin, cookie handling inside the shell, multipart boundaries,
// and the response interceptors that catch an HTML page where data was
// expected. Only the URL rules above and the envelope unwrap are this app's.
const client = createAppClient({ appName: 'repositories' })

function withBase<T extends { baseURL?: string }>(config?: T): T {
  return { ...(config ?? ({} as T)), baseURL: config?.baseURL ?? computeApiBasepath() }
}

// Unwrap the data envelope ({"data": {...}}), and raise an application error
// the server put in a 200 body.
export function unwrapData<T>(responseData: unknown): T {
  if (responseData && typeof responseData === 'object') {
    if ('error' in responseData) {
      const errorData = responseData as { error: string; status?: number }
      const error = new Error(errorData.error)
      ;(error as Error & { status?: number }).status = errorData.status || 400
      throw error
    }
    if ('data' in responseData) {
      return (responseData as { data: T }).data
    }
  }
  return responseData as T
}

export const reposRequest = {
  get: async <TResponse>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method'>
  ): Promise<TResponse> => {
    return unwrapData<TResponse>(await client.get<unknown>(url, withBase(config)))
  },

  post: async <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> => {
    return unwrapData<TResponse>(await client.post<unknown, TBody>(url, data, withBase(config)))
  },

  // Download a binary response and trigger a browser save. Falls back to a
  // generic filename if the server omits Content-Disposition.
  download: async (
    url: string,
    fallbackFilename: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method' | 'responseType'>
  ): Promise<void> => {
    const response = await client.instance.get(url, withBase({ ...config, responseType: 'blob' as const }))
    const cd = response.headers['content-disposition'] as string | undefined
    const match = cd?.match(/filename="?([^";]+)"?/)
    const filename = match?.[1] || fallbackFilename
    // A bare anchor-click save silently no-ops in the shell's sandboxed
    // iframe; shellSaveBlob hands the blob to the parent shell to save. The
    // empty Error message makes normalizeError fall through to the caller's
    // translated fallback.
    if (!(await shellSaveBlob(response.data as Blob, filename))) {
      throw new Error('')
    }
  },
}

export default reposRequest
