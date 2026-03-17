// Shell storage utilities for repositories app - stores last visited repo
// null means "All Repositories" view, a repo ID means a specific repository

import { shellStorage } from '@mochi/web'

const STORAGE_KEY = 'mochi-repos-last'
// Special value to indicate "All Repositories" view
const ALL_REPOS = 'all'

// Store last visited repository (null for "All Repositories" view)
export function setLastRepo(repoId: string | null): void {
  shellStorage.setItem(STORAGE_KEY, repoId ?? ALL_REPOS)
}

// Get last visited repository (null means "All Repositories" view)
export async function getLastRepo(): Promise<string | null> {
  const value = await shellStorage.getItem(STORAGE_KEY)
  if (value === null || value === ALL_REPOS) {
    return null
  }
  return value
}

// Clear last repository
export function clearLastRepo(): void {
  shellStorage.removeItem(STORAGE_KEY)
}
