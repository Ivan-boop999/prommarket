import { useCallback, useEffect, useState } from 'react'

/**
 * A localStorage-backed collection hook for the marketplace buyer surfaces
 * (cart, favorites, compare). No Zustand: the project keeps client state in
 * URL params or React state, and these collections are genuinely client-only
 * (a buyer's draft selections before they sign in or place an RFQ).
 *
 * Cross-tab sync is via the `storage` event: a write in one tab updates every
 * other tab open on the same origin. Each collection owns one localStorage key
 * and stores an array of product ids.
 *
 * The hook is deliberately generic over the id type so the same code backs
 * three surfaces. Persistence is best-effort: a disabled / quota-exceeded
 * localStorage degrades to in-memory state without throwing.
 */

const STORAGE_EVENT = 'storage'

export function createLocalCollection(key: string) {
  function readStorage(): string[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
    } catch {
      return []
    }
  }

  function writeStorage(values: string[]): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(values))
      // `storage` events do not fire in the writing tab, so dispatch a custom
      // event so the originating tab's React state updates too.
      window.dispatchEvent(new CustomEvent(`local-collection:${key}`))
    } catch {
      // Quota / disabled storage: silently degrade to in-memory.
    }
  }

  function useLocalCollection() {
    const [ids, setIds] = useState<string[]>(() => readStorage())

    useEffect(() => {
      const sync = () => setIds(readStorage())
      // Cross-tab.
      window.addEventListener(STORAGE_EVENT, sync)
      // Same-tab (our own writes).
      window.addEventListener(`local-collection:${key}`, sync)
      return () => {
        window.removeEventListener(STORAGE_EVENT, sync)
        window.removeEventListener(`local-collection:${key}`, sync)
      }
    }, [])

    const add = useCallback((id: string) => {
      setIds((prev) => {
        if (prev.includes(id)) return prev
        const next = [...prev, id]
        writeStorage(next)
        return next
      })
    }, [])

    const remove = useCallback((id: string) => {
      setIds((prev) => {
        const next = prev.filter((v) => v !== id)
        writeStorage(next)
        return next
      })
    }, [])

    const toggle = useCallback((id: string) => {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
        writeStorage(next)
        return next
      })
    }, [])

    const clear = useCallback(() => {
      writeStorage([])
      setIds([])
    }, [])

    const has = useCallback((id: string) => ids.includes(id), [ids])

    return { ids, count: ids.length, add, remove, toggle, clear, has }
  }

  return useLocalCollection
}

// Three marketplace collections, each with its own localStorage key.
export const useCart = createLocalCollection('prommarket:cart')
export const useFavorites = createLocalCollection('prommarket:favorites')
export const useCompare = createLocalCollection('prommarket:compare')
