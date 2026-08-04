import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WORDLE } from '../../content/puzzles'
import { isValidGuess } from '../../lib/dictionary'
import { setGameStatus } from '../../lib/progress'
import { usePersistentState } from '../../lib/usePersistentState'
import { evaluateGuess, mergeKeyStates } from '../../lib/wordle-eval'
import type { LetterState } from '../../lib/wordle-eval'
import { useToasts } from '../../components/Toast'
import Keyboard from './Keyboard'
import './wordle.css'

const ROWS = 6
const COLS = 5
const KEY = 'three-months:v1:wordle'

/** Per-tile stagger and flip duration. Mirrored in wordle.css. */
const FLIP_STAGGER_MS = 260
const FLIP_DURATION_MS = 500

interface SavedState {
  guesses: string[]
  status: 'in-progress' | 'won' | 'lost'
}

const INITIAL: SavedState = { guesses: [], status: 'in-progress' }

export default function Wordle({ onBack }: { onBack: () => void }) {
  const answer = WORDLE.answer.toUpperCase()

  const [saved, setSaved] = usePersistentState<SavedState>(KEY, INITIAL)
  const [current, setCurrent] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [showResult, setShowResult] = useState(false)

  // How many rows have finished flipping. A restored game starts fully
  // revealed, so a refresh doesn't replay every animation from the top.
  const [revealed, setRevealed] = useState(() => saved.guesses.length)
  const revealingRow = saved.guesses.length > revealed ? revealed : null

  const { toast, layer } = useToasts()
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const evaluations = useMemo(
    () => saved.guesses.map((g) => evaluateGuess(g, answer)),
    [saved.guesses, answer],
  )

  // Keyboard colours deliberately lag the board: a key must not light up
  // before the tile that justified it has finished flipping.
  const keyStates = useMemo(() => {
    let acc: Record<string, LetterState> = {}
    for (let i = 0; i < revealed; i++) {
      acc = mergeKeyStates(acc, saved.guesses[i], evaluations[i])
    }
    return acc
  }, [saved.guesses, evaluations, revealed])

  const finished = saved.status !== 'in-progress'

  const reject = useCallback(
    (message: string) => {
      setInvalid(true)
      toast(message)
      timers.current.push(window.setTimeout(() => setInvalid(false), 550))
    },
    [toast],
  )

  const submit = useCallback(() => {
    if (finished || revealingRow !== null) return

    if (current.length < COLS) return reject('Not enough letters')
    if (!isValidGuess(current)) return reject('Not in word list')

    const guesses = [...saved.guesses, current]
    const won = current === answer
    const lost = !won && guesses.length === ROWS

    setSaved({ guesses, status: won ? 'won' : lost ? 'lost' : 'in-progress' })
    setCurrent('')

    const revealMs = (COLS - 1) * FLIP_STAGGER_MS + FLIP_DURATION_MS
    timers.current.push(
      window.setTimeout(() => {
        setRevealed(guesses.length)
        if (won || lost) {
          setGameStatus('wordle', won ? 'won' : 'lost')
          timers.current.push(window.setTimeout(() => setShowResult(true), 450))
        }
      }, revealMs),
    )
  }, [current, saved.guesses, answer, finished, revealingRow, setSaved, reject])

  const onKey = useCallback(
    (key: string) => {
      if (finished || revealingRow !== null) return
      if (key === 'ENTER') return submit()
      if (key === 'BACKSPACE') return setCurrent((c) => c.slice(0, -1))
      if (/^[A-Z]$/.test(key)) setCurrent((c) => (c.length < COLS ? c + key : c))
    },
    [finished, revealingRow, submit],
  )

  // Physical keyboard, for testing on a laptop. She'll only ever use the
  // on-screen one; iOS has no hardware keyboard to listen to.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toUpperCase()
      if (key === 'ENTER' || key === 'BACKSPACE' || /^[A-Z]$/.test(key)) {
        e.preventDefault()
        onKey(key)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKey])

  const rows = Array.from({ length: ROWS }, (_, r) => {
    if (r < saved.guesses.length) {
      return {
        letters: saved.guesses[r],
        states: evaluations[r],
        animate: r === revealingRow,
      }
    }
    if (r === saved.guesses.length) {
      return { letters: current.padEnd(COLS), states: null, animate: false }
    }
    return { letters: ' '.repeat(COLS), states: null, animate: false }
  })

  return (
    <div className="screen wordle no-select">
      <div className="topbar">
        <button className="topbar__button" onClick={onBack} aria-label="Back to menu">
          ‹ Menu
        </button>
        <span className="topbar__title">Wordle</span>
        <span className="topbar__button" aria-hidden="true" />
      </div>

      {layer}

      <div className="wordle__board-area">
        <div className="wordle__board">
          {rows.map((row, r) => (
            <div
              key={r}
              className={`wordle__row ${
                invalid && r === saved.guesses.length ? 'shake' : ''
              }`}
            >
              {Array.from({ length: COLS }, (_, c) => {
                const letter = row.letters[c]?.trim() ?? ''
                const state = row.states?.[c]
                const settled = row.states !== null && !row.animate
                return (
                  <div
                    key={c}
                    className={[
                      'tile',
                      letter ? 'tile--filled' : '',
                      settled && state ? `tile--${state}` : '',
                      row.animate ? 'tile--flip' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      row.animate && state
                        ? ({
                            animationDelay: `${c * FLIP_STAGGER_MS}ms`,
                            '--flip-to': `var(--${state})`,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {letter}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <Keyboard keyStates={keyStates} onKey={onKey} disabled={finished} />

      {showResult && (
        <div className="sheet-backdrop" onClick={() => setShowResult(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="sheet__title">
              {saved.status === 'won'
                ? saved.guesses.length === 1
                  ? 'First try?!'
                  : 'Got it'
                : 'So close'}
            </h2>
            <p className="sheet__word">{answer}</p>
            <p className="sheet__caption">{WORDLE.caption}</p>
            <div className="sheet__actions">
              <button className="btn btn--primary" onClick={onBack}>
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {finished && !showResult && (
        <button className="wordle__reopen" onClick={() => setShowResult(true)}>
          See result
        </button>
      )}
    </div>
  )
}
