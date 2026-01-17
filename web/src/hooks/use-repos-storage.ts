// localStorage utilities for repositories app - stores last visited repo per browser
// null means "All Repositories" view, a repo ID means a specific repository

const STORAGE_KEY = 'mochi-repos-last'
const SESSION_KEY = 'mochi-repos-session-started'

// Special value to indicate "All Repositories" view
const ALL_REPOS = 'all'

// Store last visited repository (null for "All Repositories" view)
export function setLastRepo(repoId: string | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, repoId ?? ALL_REPOS)
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

// Get last visited repository (null means "All Repositories" view)
export function getLastRepo(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === null || value === ALL_REPOS) {
      return null
    }
    return value
  } catch {
    return null
  }
}

// Clear last repository
export function clearLastRepo(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently fail
  }
}

// Check if this is the first navigation to the index this session
// Used to only auto-redirect on initial app entry, not subsequent navigations
export function shouldRedirectToLastRepo(): boolean {
  try {
    // If session already started, don't redirect
    if (sessionStorage.getItem(SESSION_KEY)) {
      return false
    }
    // Mark session as started
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  } catch {
    return false
  }
}
