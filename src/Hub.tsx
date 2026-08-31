import { HUB } from './content/puzzles'
import { allFinished, finishedCount, isFinished, useProgress } from './lib/progress'
import type { GameStatus } from './lib/progress'
import type { Route } from './lib/useHashRoute'
import './styles/hub.css'

interface HubProps {
  onNavigate: (to: Route) => void
}

function StatusBadge({ status }: { status: GameStatus }) {
  if (status === 'won') return <span className="badge badge--done">Solved</span>
  if (status === 'lost') return <span className="badge badge--done">Finished</span>
  if (status === 'in-progress') return <span className="badge">In progress</span>
  return <span className="badge badge--new">Play</span>
}

function WordleGlyph() {
  return (
    <div className="glyph glyph--wordle" aria-hidden="true">
      <span className="glyph__tile glyph__tile--correct" />
      <span className="glyph__tile" />
      <span className="glyph__tile glyph__tile--present" />
    </div>
  )
}

function ConnectionsGlyph() {
  return (
    <div className="glyph glyph--connections" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`glyph__cell glyph__cell--${i}`} />
      ))}
    </div>
  )
}

function StrandsGlyph() {
  return (
    <svg className="glyph glyph--strands" viewBox="0 0 40 28" aria-hidden="true">
      <path
        d="M6 20 L14 8 L26 18 L34 6"
        fill="none"
        stroke="var(--strand-span)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [6, 20],
        [14, 8],
        [26, 18],
        [34, 6],
      ].map(([cx, cy]) => (
        <circle key={`${cx}`} cx={cx} cy={cy} r="3.5" fill="var(--strand-word)" />
      ))}
    </svg>
  )
}

export default function Hub({ onNavigate }: HubProps) {
  const progress = useProgress()
  const done = finishedCount(progress)
  const unlocked = allFinished(progress)

  const games = [
    {
      route: 'wordle' as const,
      name: 'Wordle',
      blurb: HUB.wordleBlurb,
      status: progress.wordle,
      glyph: <WordleGlyph />,
    },
    {
      route: 'connections' as const,
      name: 'Connections',
      blurb: HUB.connectionsBlurb,
      status: progress.connections,
      glyph: <ConnectionsGlyph />,
    },
    {
      route: 'strands' as const,
      name: 'Strands',
      blurb: HUB.strandsBlurb,
      status: progress.strands,
      glyph: <StrandsGlyph />,
    },
  ]

  return (
    <div className="screen hub">
      {/* The hub is no longer the front door — Friday is. Without this she'd
          have no way back short of editing the URL. */}
      <div className="topbar">
        <button
          className="topbar__button"
          onClick={() => onNavigate('viernes')}
          aria-label="Back to Friday"
        >
          ←
        </button>
        {/* No title here: the h1 below already says it. */}
        <span className="topbar__button" aria-hidden="true" />
      </div>

      <header className="hub__header">
        <h1 className="hub__title">{HUB.title}</h1>
        <p className="hub__subtitle">{HUB.subtitle}</p>
      </header>

      <div className="hub__cards">
        {games.map((game) => (
          <button
            key={game.route}
            className={`card ${isFinished(game.status) ? 'card--done' : ''}`}
            onClick={() => onNavigate(game.route)}
          >
            <div className="card__glyph">{game.glyph}</div>
            <div className="card__body">
              <span className="card__name">{game.name}</span>
              <span className="card__blurb">{game.blurb}</span>
            </div>
            <StatusBadge status={game.status} />
          </button>
        ))}
      </div>

      <div className="hub__finale">
        <div className="hub__progress" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`pip ${i < done ? 'pip--on' : ''}`} />
          ))}
        </div>
        <button
          className={`finale-card ${unlocked ? 'finale-card--open' : ''}`}
          disabled={!unlocked}
          onClick={() => onNavigate('finale')}
        >
          <span className="finale-card__icon">{unlocked ? '💌' : '🔒'}</span>
          <span className="finale-card__text">
            {unlocked ? HUB.unlockedFinale : HUB.lockedFinale}
          </span>
        </button>
      </div>
    </div>
  )
}
