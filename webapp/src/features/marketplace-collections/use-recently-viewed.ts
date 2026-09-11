import { useCallback, useEffect, useState } from 'react'

/**
 * Recently-viewed product ids for the public marketplace (Avito-style
 * «вы недавно смотрели»). Same pattern as use-local-collection: localStorage,
 * cross-tab sync via events, best-effort persistence. Newest first, capped.
 */
const KEY = 'prommarket:recently-viewed'
const CHANGE_EVENT = `local-collection:${KEY}`
const CAP = 12

function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // Quota / disabled storage: silently degrade to in-memory state.
  }
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(read)

  useEffect(() => {
    const sync = () => setIds(read())
    window.addEventListener('storage', sync)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CHANGE_EVENT, sync)
    }
  }, [])

  const push = useCallback((id: string) => {
    setIds((prev) => {
      if (prev[0] === id) return prev
      const next = [id, ...prev.filter((v) => v !== id)].slice(0, CAP)
      write(next)
      return next
    })
  }, [])

  return { ids, push }
}
