import './LogPanel.css'
import type { PointLog } from '../App'

interface LogPanelProps {
  logs: PointLog[]
  onDelete: (id: string) => void
}

export default function LogPanel({ logs, onDelete }: LogPanelProps) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayLogs = logs.filter(l => l.timestamp.slice(0, 10) === todayStr)
  const total = todayLogs.reduce((sum, l) => sum + l.points, 0)

  const dailyTotals: Record<string, number> = {}
  for (const log of logs) {
    const day = log.timestamp.slice(0, 10)
    dailyTotals[day] = (dailyTotals[day] || 0) + log.points
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const y = year
    const m = String(month + 1).padStart(2, '0')
    const day = String(d).padStart(2, '0')
    days.push(`${y}-${m}-${day}`)
  }

  const values = days.map(d => dailyTotals[d] || 0)
  const maxVal = Math.max(...values, 0)
  const yMax = Math.ceil(maxVal / 10) * 10 || 10
  const ySteps = yMax / 10

  const padL = 36, padR = 12, padT = 12, padB = 24
  const W = 500, H = 220
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const stepX = chartW / (days.length - 1 || 1)

  const points = values.map((v, i) => {
    const x = padL + i * stepX
    const y = padT + chartH - (v / yMax) * chartH
    return { x, y, v, day: days[i] }
  })
  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = lineD + ` L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`

  function formatTime(iso: string) {
    const d = new Date(iso)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return `${date} ${time}`
  }

  return (
    <div className="log-panel">
      <div className="log-header">
        <h2>Point Logs</h2>
        <span className="log-total">Total: {total}pts</span>
      </div>

      <div className="log-body">
        {logs.length > 0 && (
          <div className="log-chart-area">
            <div className="log-chart-label">
              {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="log-chart">
              {Array.from({ length: ySteps + 1 }, (_, i) => {
                const val = i * 10
                const y = padT + chartH - (val / yMax) * chartH
                return (
                  <g key={i}>
                    <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="1" />
                    <text x={padL - 4} y={y + 3} textAnchor="end" className="log-chart-text">{val}</text>
                  </g>
                )
              })}
              <path d={areaD} fill="var(--accent-bg)" />
              <path d={lineD} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {points.map(p => (
                <text key={p.day} x={p.x} y={H - 2} textAnchor="middle" className="log-chart-text">{parseInt(p.day.slice(8))}</text>
              ))}
              {points.filter(p => p.v > 0).map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)">
                  <title>{p.day}: {p.v}pts</title>
                </circle>
              ))}
            </svg>
          </div>
        )}

        <div className="log-sidebar">
          <div className="log-sidebar-header">Activity</div>
          {todayLogs.length === 0 ? (
            <div className="log-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    No point entries today
                  </div>
          ) : (
            <div className="log-sidebar-list">
              {todayLogs.map(log => (
                <div key={log.id} className="log-entry">
                  <span className={`log-points ${log.points > 0 ? 'positive' : ''}`}>
                    {log.points > 0 ? '+' : ''}{log.points}
                  </span>
                  <div className="log-entry-info">
                    <span className="log-reason">{log.reason}</span>
                    <span className="log-time">{formatTime(log.timestamp)}</span>
                  </div>
                  <button
                    className="log-delete"
                    onClick={() => onDelete(log.id)}
                    title="Remove this log entry"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
