import { useEffect } from 'react'
import Hub from './Hub'
import Wordle from './games/Wordle/Wordle'
import Connections from './games/Connections/Connections'
import Strands from './games/Strands/Strands'
import Finale from './Finale'
import { allFinished, useProgress } from './lib/progress'
import { useHashRoute } from './lib/useHashRoute'

export default function App() {
  const [route, navigate] = useHashRoute()
  const progress = useProgress()

  // Deep-linking straight to /finale before it's earned would spoil the ending.
  useEffect(() => {
    if (route === 'finale' && !allFinished(progress)) navigate('hub')
  }, [route, progress, navigate])

  switch (route) {
    case 'wordle':
      return <Wordle onBack={() => navigate('hub')} />
    case 'connections':
      return <Connections onBack={() => navigate('hub')} />
    case 'strands':
      return <Strands onBack={() => navigate('hub')} />
    case 'finale':
      return <Finale onBack={() => navigate('hub')} />
    default:
      return <Hub onNavigate={navigate} />
  }
}
