import { useSyncExternalStore } from 'react'
import { loadJSON, saveJSON } from './storage'

export type GameId = 'wordle' | 'connections' | 'strands'
export type GameStatus = 'not-started' | 'in-progress' | 'won' | 'lost'

export interface Progress {
  wordle: GameStatus
  connections: GameStatus
  strands: GameStatus
  finaleSeen: boolean
}

const KEY = 'three-months:v1:progress'

const DEFAULT: Progress = {
  wordle: 'not-started',
  connections: 'not-started',
  strands: 'not-started',
  finaleSeen: false,
}

let current: Progress = { ...DEFAULT, ...loadJSON<Partial<Progress>>(KEY, {}) }

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Progress {
  return current
}

export function updateProgress(patch: Partial<Progress>): void {
  current = { ...current, ...patch }
  saveJSON(KEY, current)
  for (const listener of listeners) listener()
}

export function setGameStatus(id: GameId, status: GameStatus): void {
  if (current[id] === status) return
  updateProgress({ [id]: status } as Partial<Progress>)
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * A game counts as finished whether she won or lost.
 *
 * This is deliberate: the finale is the whole point of the gift, and locking
 * her out of it because Connections beat her would be a miserable outcome.
 */
export function isFinished(status: GameStatus): boolean {
  return status === 'won' || status === 'lost'
}

export function finishedCount(p: Progress): number {
  return [p.wordle, p.connections, p.strands].filter(isFinished).length
}

export function allFinished(p: Progress): boolean {
  return finishedCount(p) === 3
}

/** Wipe every key this app owns — used by the dev-only reset control. */
export function resetEverything(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('three-months:')) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
  current = { ...DEFAULT }
  for (const listener of listeners) listener()
}
