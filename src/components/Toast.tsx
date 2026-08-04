import { useCallback, useRef, useState } from 'react'

interface ToastItem {
  id: number
  message: string
}

/**
 * Minimal toast queue. Wordle leans on this constantly ("Not in word list",
 * "Genius"), so it lives outside the game components.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const toast = useCallback((message: string, durationMs = 1600) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, durationMs)
  }, [])

  const layer = (
    <div className="toast-layer" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          {t.message}
        </div>
      ))}
    </div>
  )

  return { toast, layer }
}
