/**
 * localStorage wrappers that never throw.
 *
 * iOS Safari in Private Browsing raises QuotaExceededError on every write, and
 * an unhandled throw here would take down the whole app on load. Losing saved
 * progress is an acceptable degradation; a blank screen is not.
 */

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private Browsing, or storage full. Progress simply won't persist.
  }
}
