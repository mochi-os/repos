// Repositories app request helpers
// Computes API basepath fresh each request to handle both class and entity context

import axios, { type AxiosRequestConfig } from 'axios'
import { getCookie, useAuthStore } from '@mochi/common'

// Known class-level routes that should not be treated as entity IDs
const CLASS_ROUTES = ['new', 'settings']

// Check if a string looks like an entity ID (50-51 chars) or fingerprint (9 chars) - both base58
function isEntityIdentifier(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(s) || /^[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(s)
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

  // Add auth token
  const storeToken = useAuthStore.getState().token
  const cookieToken = getCookie('token')
  const token = storeToken || cookieToken

  if (token) {
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
    throw new Error('Invalid response from server')
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
}

export default reposRequest
