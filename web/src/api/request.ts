// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Repositories app request helpers
// Computes API basepath fresh each request to handle both class and entity context

import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore, isInShell, isDomainEntityRouting, shellSaveBlob } from '@mochi/web'

// Known class-level routes that should not be treated as entity IDs
const CLASS_ROUTES = ['new', 'settings']

// Check if a string looks like an entity ID (50-51 chars) or fingerprint (9 chars) - both base58
function isEntityIdentifier(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(s)
}

// Get app-level base path (class context, not entity context)
// Always returns /<app>/ regardless of current entity context
export function appBasePath(): string {
  const pathname = window.location.pathname
  const match = pathname.match(/^(\/[^/]+)/)
  return match ? `${match[1]}/` : '/'
}

// Entity-level base path for a specific repository, valid in all three routing contexts:
// entity routing (/<fingerprint>/) and domain routing (git.mochi-os.org/<repo>/) both put the
// repository as the first path segment; only app routing (/<app>/<repo>/) needs the app prefix.
export function repoBasePath(repoId: string): string {
  const firstSegment = window.location.pathname.match(/^\/([^/]+)/)?.[1] || ''
  const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment)
  return isEntityContext || isDomainEntityRouting()
    ? `/${repoId}/-/`
    : `/${firstSegment}/${repoId}/-/`
}

// Compute API basepath fresh (no caching) to handle navigation between contexts
function computeApiBasepath(): string {
  const pathname = window.location.pathname

  // Check for direct entity routing: /<entity>/
  const directMatch = pathname.match(/^\/([^/]+)/)
  if (directMatch && isEntityIdentifier(directMatch[1])) {
    return `/${directMatch[1]}/-/`
  }

  // Check for /<app>/<entity>/ pattern
  const match = pathname.match(/^(\/[^/]+)\/([^/]+)/)
  if (match && !CLASS_ROUTES.includes(match[2]) && isEntityIdentifier(match[2])) {
    return `${match[1]}/${match[2]}/-/`
  }

  // Check for domain routing (server meta tag or shell-init domain context)
  if (directMatch && isDomainEntityRouting()) {
    return `/${directMatch[1]}/-/`
  }

  // Class context: use first segment as app path
  if (directMatch) {
    return `/${directMatch[1]}/`
  }

  return '/'
}

// Create a repositories-specific axios instance
const reposClient = axios.create({
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
})

reposClient.interceptors.request.use((config) => {
  // Use provided baseURL or compute fresh from pathname
  if (!config.baseURL) {
    config.baseURL = computeApiBasepath()
  }

  // Remove Content-Type for FormData so axios can set the multipart boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  // In sandboxed iframe, cookies are unavailable — always use Bearer auth only
  if (isInShell()) {
    config.withCredentials = false
  }

  // Add auth token
  const token = useAuthStore.getState().token

  if (token) {
    // HTTP Authorization header — protocol literal, never translated.
    // eslint-disable-next-line lingui/no-unlocalized-strings
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  }

  return config
})

// Extract error message from response body on error status codes
reposClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data) {
      const data = error.response.data
      // Handle JSON error response
      if (typeof data === 'object' && 'error' in data) {
        const newError = new Error(data.error)
        ;(newError as Error & { status?: number }).status = error.response.status
        return Promise.reject(newError)
      }
      // Handle HTML error response - extract message from <pre> tag
      if (typeof data === 'string' && data.includes('<pre>')) {
        const match = data.match(/<pre>([^<]+)<\/pre>/)
        if (match) {
          const newError = new Error(match[1])
          ;(newError as Error & { status?: number }).status = error.response.status
          return Promise.reject(newError)
        }
      }
    }
    return Promise.reject(error)
  }
)

// Unwrap data envelope if present (backend returns {"data": {...}})
// Also check for error responses and throw them
function unwrapData<T>(responseData: unknown): T {
  // Check for HTML response (indicates wrong URL or server error)
  if (typeof responseData === 'string' && responseData.trim().startsWith('<!')) {
    // Try to extract a meaningful error from the HTML
    const titleMatch = responseData.match(/<title>([^<]+)<\/title>/)
    const preMatch = responseData.match(/<pre>([^<]+)<\/pre>/)
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const message = preMatch?.[1] || titleMatch?.[1] || 'Server returned HTML instead of JSON (possible routing error)'
    throw new Error(message)
  }
  if (
    responseData &&
    typeof responseData === 'object'
  ) {
    // Check for error response
    if ('error' in responseData) {
      const errorData = responseData as { error: string; status?: number }
      const error = new Error(errorData.error)
      ;(error as Error & { status?: number }).status = errorData.status || 400
      throw error
    }
    // Unwrap data envelope
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
    const response = await reposClient.get(url, config)
    return unwrapData<TResponse>(response.data)
  },

  post: async <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> => {
    const response = await reposClient.post(url, data, config)
    return unwrapData<TResponse>(response.data)
  },

  // Download a binary response and trigger a browser save. Falls back to a
  // generic filename if the server omits Content-Disposition.
  download: async (
    url: string,
    fallbackFilename: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method' | 'responseType'>
  ): Promise<void> => {
    const response = await reposClient.get(url, { ...config, responseType: 'blob' })
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
