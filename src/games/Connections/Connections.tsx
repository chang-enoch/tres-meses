export default function Connections({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar__button" onClick={onBack}>Back</button>
        <span className="topbar__title">Connections</span>
        <span className="topbar__button" />
      </div>
      <p style={{ padding: 24 }}>Coming up.</p>
    </div>
  )
}
