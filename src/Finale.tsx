import { useEffect, useState } from 'react'
import { FINALE } from './content/finale'
import { PHOTOS } from './content/finale-assets.gen'
import type { FinaleAsset } from './content/finale-assets.gen'
import { updateProgress } from './lib/progress'
import './styles/finale.css'

/** Vite rewrites BASE_URL to the repo subpath on Pages, so asset URLs survive deploy. */
const asset = (src: string) => `${import.meta.env.BASE_URL}finale/${src}`

/**
 * Deterministic per-index jitter, so the collage looks hand-arranged but never
 * reshuffles as she scrolls or the component re-renders.
 */
function tilt(index: number, spread = 4): number {
  const wobble = Math.sin(index * 12.9898) * 43758.5453
  return ((wobble - Math.floor(wobble)) * 2 - 1) * spread
}

export default function Finale({ onBack }: { onBack: () => void }) {
  const [opened, setOpened] = useState(false)
  const [lightbox, setLightbox] = useState<FinaleAsset | null>(null)

  useEffect(() => {
    if (opened) updateProgress({ finaleSeen: true })
  }, [opened])

  if (!opened) {
    return (
      <div className="screen finale finale--sealed">
        <button className="envelope" onClick={() => setOpened(true)}>
          <span className="envelope__flap" aria-hidden="true" />
          <span className="envelope__seal" aria-hidden="true">
            ♥
          </span>
          <span className="envelope__teaser">{FINALE.teaser}</span>
        </button>
        <p className="finale__hint">{FINALE.openLabel}</p>
      </div>
    )
  }

  return (
    <div className="screen finale">
      <div className="hearts" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="heart" style={{ '--i': i } as React.CSSProperties}>
            ♥
          </span>
        ))}
      </div>

      <div className="letter">
        <p className="letter__date">{FINALE.date}</p>
        <h1 className="letter__headline">{FINALE.headline}</h1>

        {FINALE.message.map((paragraph, i) => (
          <p key={i} className="letter__para">
            {paragraph}
          </p>
        ))}

        <p className="letter__signoff">{FINALE.signoff}</p>
      </div>

      {PHOTOS.length > 0 && (
        <div className="collage">
          {FINALE.photoCaption && <p className="collage__caption">{FINALE.photoCaption}</p>}

          {PHOTOS.map((photo, i) => (
            <div
              key={photo.src}
              className="polaroid"
              style={{ '--tilt': `${tilt(i)}deg` } as React.CSSProperties}
            >
              <button className="polaroid__button" onClick={() => setLightbox(photo)}>
                <img
                  src={asset(photo.src)}
                  width={photo.w}
                  height={photo.h}
                  alt=""
                  // Intrinsic dimensions above + lazy loading keeps the page
                  // from jumping around as images arrive over cellular.
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="finale__actions">
        <button className="btn" onClick={onBack}>
          Back to the puzzles
        </button>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog">
          <img src={asset(lightbox.src)} alt="" />
          <span className="lightbox__hint">Tap anywhere to close</span>
        </div>
      )}
    </div>
  )
}
