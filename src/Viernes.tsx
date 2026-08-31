import { useEffect, useState } from 'react'
import BeliTeaser from './components/BeliTeaser'
import { DINNER_AT, VIERNES } from './content/viernes'
import type { Route } from './lib/useHashRoute'
import './styles/viernes.css'

interface ViernesProps {
  onNavigate: (to: Route) => void
}

/**
 * Ticking clock down to an absolute instant.
 *
 * The visibilitychange listener matters on iOS: Safari throttles or suspends
 * timers in a backgrounded tab, so without it she'd come back to a countdown
 * frozen at whatever second she left on.
 */
function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const sync = () => setNow(Date.now())
    const id = setInterval(sync, 1000)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const remaining = target - now
  const total = Math.max(0, Math.floor(remaining / 1000))

  return {
    past: remaining <= 0,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function Viernes({ onNavigate }: ViernesProps) {
  const { past, days, hours, minutes, seconds } = useCountdown(DINNER_AT)

  const cells = [
    { value: String(days), label: 'days' },
    { value: pad(hours), label: 'hrs' },
    { value: pad(minutes), label: 'min' },
    { value: pad(seconds), label: 'sec' },
  ]

  return (
    <div className="screen viernes">
      <header className="viernes__header">
        <p className="viernes__dateline">{VIERNES.dateline}</p>
        <h1 className="viernes__title">{VIERNES.title}</h1>
        <p className="viernes__subtitle">{VIERNES.subtitle}</p>
      </header>

      {past ? (
        <p className="viernes__now">{VIERNES.afterLabel}</p>
      ) : (
        <div className="countdown">
          {cells.map((cell) => (
            <div key={cell.label} className="countdown__cell">
              <span className="countdown__value">{cell.value}</span>
              <span className="countdown__label">{cell.label}</span>
            </div>
          ))}
          <p className="countdown__caption">{VIERNES.countdownLabel}</p>
        </div>
      )}

      <BeliTeaser />

      <div className="logistics">
        {VIERNES.logistics.map((row) => (
          <div key={row.value} className="logistics__row">
            <span className="logistics__value">{row.value}</span>
            <span className="logistics__note">{row.note}</span>
          </div>
        ))}
      </div>

      <button className="viernes__back" onClick={() => onNavigate('hub')}>
        {VIERNES.hubLink} →
      </button>
    </div>
  )
}
