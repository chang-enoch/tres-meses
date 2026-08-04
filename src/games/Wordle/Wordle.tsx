export default function Wordle({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar__button" onClick={onBack}>Back</button>
        <span className="topbar__title">Wordle</span>
        <span className="topbar__button" />
      </div>
      <p style={{ padding: 24 }}>Coming up.</p>
    </div>
  )
}
