import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Drop-in replacement for useState that mirrors the value to localStorage,
 * so it survives reloads. Falls back to `initialValue` when nothing is stored
 * or storage is unavailable (SSR, private mode, quota).
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? initialValue : (JSON.parse(raw) as T)
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, [key, value])

  return [value, setValue]
}
