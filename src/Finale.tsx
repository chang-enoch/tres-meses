export default function Finale({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar__button" onClick={onBack}>Back</button>
        <span className="topbar__title">Finale</span>
        <span className="topbar__button" />
      </div>
      <p style={{ padding: 24 }}>Coming up.</p>
    </div>
  )
}
