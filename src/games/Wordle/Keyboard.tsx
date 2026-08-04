import type { LetterState } from '../../lib/wordle-eval'

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

interface KeyboardProps {
  keyStates: Record<string, LetterState>
  onKey: (key: string) => void
  disabled: boolean
}

export default function Keyboard({ keyStates, onKey, disabled }: KeyboardProps) {
  const key = (label: string, value: string, wide = false) => (
    <button
      key={value}
      className={[
        'key',
        wide ? 'key--wide' : '',
        keyStates[value] ? `key--${keyStates[value]}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      // pointerdown rather than click: it fires the moment her finger lands,
      // which makes typing feel immediate instead of laggy on touch.
      onPointerDown={(e) => {
        e.preventDefault()
        if (!disabled) onKey(value)
      }}
      aria-label={value === 'BACKSPACE' ? 'Backspace' : value}
    >
      {label}
    </button>
  )

  return (
    <div className="keyboard" role="group" aria-label="Keyboard">
      <div className="keyboard__row">
        {ROWS[0].split('').map((l) => key(l, l))}
      </div>
      <div className="keyboard__row">
        <span className="keyboard__spacer" />
        {ROWS[1].split('').map((l) => key(l, l))}
        <span className="keyboard__spacer" />
      </div>
      <div className="keyboard__row">
        {key('Enter', 'ENTER', true)}
        {ROWS[2].split('').map((l) => key(l, l))}
        {key('⌫', 'BACKSPACE', true)}
      </div>
    </div>
  )
}
