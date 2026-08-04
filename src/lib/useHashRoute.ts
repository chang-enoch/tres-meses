import { useCallback, useEffect, useState } from 'react'

export type Route = 'hub' | 'wordle' | 'connections' | 'strands' | 'finale'

const ROUTES: readonly Route[] = ['hub', 'wordle', 'connections', 'strands', 'finale']

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return ROUTES.includes(raw as Route) ? (raw as Route) : 'hub'
}

/**
 * Hash routing rather than history routing.
 *
 * GitHub Pages serves static files only, so a hard refresh on /wordle would
 * 404 under a history router unless we ship a 404.html redirect hack. Hashes
 * sidestep that entirely, and the iOS back-swipe gesture still works.
 */
export function useHashRoute(): [Route, (to: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((to: Route) => {
    window.location.hash = to === 'hub' ? '/' : `/${to}`
    // Games render below the fold on short screens; always start at the top.
    window.scrollTo(0, 0)
  }, [])

  return [route, navigate]
}
