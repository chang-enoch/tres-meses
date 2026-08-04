import { useEffect, useState } from 'react'
import { loadJSON, saveJSON } from './storage'

/** useState that mirrors itself into localStorage. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJSON(key, initial))

  useEffect(() => {
    saveJSON(key, value)
  }, [key, value])

  return [value, setValue] as const
}
