import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Viernes from './Viernes'
import Hub from './Hub'
import Wordle from './games/Wordle/Wordle'
import Connections from './games/Connections/Connections'
import Strands from './games/Strands/Strands'
import Finale from './Finale'
import { CONNECTIONS, WORDLE } from './content/puzzles'
import { DINNER_AT, VIERNES } from './content/viernes'
import { resetEverything } from './lib/progress'

/**
 * Renders every screen and drives the parts a player actually touches.
 *
 * These games get one showing on someone else's phone, so a crash on first
 * paint is the failure that matters most — and it's the one a pure-logic test
 * suite would sail straight past.
 */

beforeEach(() => {
  // The countdown reads Date.now(); freeze it so the assertions can't race.
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  resetEverything()
  localStorage.clear()
})

const noop = () => {}

describe('screens render', () => {
  it('renders the Friday teaser with a live countdown and a way back', () => {
    // Pinned well before the reservation so the countdown is deterministic.
    vi.setSystemTime(DINNER_AT - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000)
    const { container } = render(<Viernes onNavigate={noop} />)

    expect(screen.getByText(VIERNES.title)).toBeDefined()
    const cells = [...container.querySelectorAll('.countdown__value')].map(
      (el) => el.textContent,
    )
    expect(cells).toEqual(['2', '03', '04', '05'])

    // The teaser is a clip, not a still: it must mount without a crash.
    expect(container.querySelector('.teaser')).not.toBeNull()

    // The old site stays reachable.
    expect(screen.getByText(new RegExp(VIERNES.hubLink, 'i'))).toBeDefined()
  })

  it('stops counting once the reservation has started', () => {
    vi.setSystemTime(DINNER_AT + 60_000)
    const { container } = render(<Viernes onNavigate={noop} />)
    expect(container.querySelector('.countdown')).toBeNull()
    expect(screen.getByText(VIERNES.afterLabel)).toBeDefined()
  })

  it('never names the restaurant', () => {
    vi.setSystemTime(DINNER_AT - 86_400_000)
    const { container } = render(<Viernes onNavigate={noop} />)
    expect(container.textContent).not.toMatch(/nobu/i)
  })

  it('renders the hub with three games locked behind the finale', () => {
    render(<Hub onNavigate={noop} />)
    expect(screen.getByText('Wordle')).toBeDefined()
    expect(screen.getByText('Connections')).toBeDefined()
    expect(screen.getByText('Strands')).toBeDefined()
    // Finale must start locked.
    expect(screen.getByText(/Finish all three/i)).toBeDefined()
  })

  it('offers a way back out of the hub to the Friday teaser', () => {
    const seen: string[] = []
    render(<Hub onNavigate={(to) => seen.push(to)} />)
    fireEvent.click(screen.getByRole('button', { name: /back to friday/i }))
    expect(seen).toEqual(['viernes'])
  })

  it('renders Wordle with a full keyboard and empty board', () => {
    const { container } = render(<Wordle onBack={noop} />)
    expect(container.querySelectorAll('.tile')).toHaveLength(30) // 6 rows x 5
    expect(screen.getByRole('button', { name: 'Q' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Backspace' })).toBeDefined()
  })

  it('renders Connections with sixteen tiles', () => {
    const { container } = render(<Connections onBack={noop} />)
    expect(container.querySelectorAll('.ctile')).toHaveLength(16)
  })

  it('renders Strands with a full board', () => {
    const { container } = render(<Strands onBack={noop} />)
    const cells = container.querySelectorAll('.scell')
    expect(cells.length).toBeGreaterThan(0)
    expect(screen.getByText(/theme words found/i)).toBeDefined()
  })

  it('renders the finale sealed, then opens it', () => {
    render(<Finale onBack={noop} />)
    const envelope = screen.getByText(/Tap to open/i)
    expect(envelope).toBeDefined()
    fireEvent.click(screen.getByRole('button'))
    expect(document.querySelector('.letter__headline')?.textContent).toMatch(/three months/i)
    expect(document.querySelector('.letter__signoff')).not.toBeNull()
  })
})

describe('Wordle input', () => {
  it('types letters into the board and deletes them', () => {
    const { container } = render(<Wordle onBack={noop} />)
    const type = (letter: string) =>
      fireEvent.pointerDown(screen.getByRole('button', { name: letter }))

    type('C')
    type('R')
    const filled = () => container.querySelectorAll('.tile--filled')
    expect(filled()).toHaveLength(2)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Backspace' }))
    expect(filled()).toHaveLength(1)
  })

  it('rejects a guess that is not a real word', () => {
    render(<Wordle onBack={noop} />)
    for (const letter of 'ZXQWJ') {
      fireEvent.pointerDown(screen.getByRole('button', { name: letter }))
    }
    fireEvent.pointerDown(screen.getByRole('button', { name: 'ENTER' }))
    expect(screen.getByText('Not in word list')).toBeDefined()
  })

  it('accepts the answer even though it may not be a dictionary word', () => {
    const { container } = render(<Wordle onBack={noop} />)
    for (const letter of WORDLE.answer.toUpperCase()) {
      fireEvent.pointerDown(screen.getByRole('button', { name: letter }))
    }
    fireEvent.pointerDown(screen.getByRole('button', { name: 'ENTER' }))
    expect(screen.queryByText('Not in word list')).toBeNull()
    expect(container.querySelectorAll('.tile--flip').length).toBe(5)
  })
})

describe('Connections rules', () => {
  const solveGroup = (index: number) => {
    for (const member of CONNECTIONS.groups[index].members) {
      fireEvent.click(screen.getByText(member))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  }

  it('solves a correct group into a band', () => {
    const { container } = render(<Connections onBack={noop} />)
    solveGroup(0)
    expect(container.querySelectorAll('.band')).toHaveLength(1)
    expect(container.querySelectorAll('.ctile')).toHaveLength(12)
  })

  it('spends a mistake on a wrong group', () => {
    const { container } = render(<Connections onBack={noop} />)
    // One member from each group can't possibly be a set.
    for (const group of CONNECTIONS.groups) {
      fireEvent.click(screen.getByText(group.members[0]))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(container.querySelectorAll('.dot--on')).toHaveLength(3)
  })

  it('does not spend a mistake on a repeated guess', () => {
    const { container } = render(<Connections onBack={noop} />)
    const wrongSet = CONNECTIONS.groups.map((g) => g.members[0])

    for (const member of wrongSet) fireEvent.click(screen.getByText(member))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(container.querySelectorAll('.dot--on')).toHaveLength(3)

    // A wrong guess leaves the four selected, the way NYT does, so she can
    // swap one tile instead of rebuilding the set. Submitting as-is is the
    // repeat case: it should be refused, not punished.
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('You already guessed that')).toBeDefined()
    expect(container.querySelectorAll('.dot--on')).toHaveLength(3)
  })
})
