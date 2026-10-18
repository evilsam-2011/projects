import { useRef } from 'react'
import { type AppSettings, type ThemeMode, type AccentColor, ACCENT_COLORS } from '../themes'
import './SettingsPanel.css'

const STORAGE_KEYS = [
  'calander-todos',
  'calander-events',
  'calander-calendars',
  'calander-point-logs',
  'calander-habits',
  'calander-settings',
]

interface SettingsPanelProps {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
}

export default function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  function setTheme(t: ThemeMode) {
    onSettingsChange({ ...settings, theme: t })
  }

  function setAccent(a: AccentColor) {
    onSettingsChange({ ...settings, accent: a })
  }

  function exportData() {
    const data: Record<string, any> = {}
    for (const key of STORAGE_KEYS) {
      const val = localStorage.getItem(key)
      if (val) data[key] = JSON.parse(val)
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calander-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        for (const key of STORAGE_KEYS) {
          if (data[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(data[key]))
          }
        }
        window.location.reload()
      } catch {
        alert('Invalid backup file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function clearAllData() {
    if (!window.confirm('Delete all data? This cannot be undone.')) return
    if (!window.confirm('Are you sure? All todos, events, habits, logs, and settings will be permanently removed.')) return
    STORAGE_KEYS.forEach(k => localStorage.removeItem(k))
    localStorage.clear()
    window.location.reload()
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Color Scheme</h3>

        <div className="settings-subsection">
          <label className="settings-label">Theme</label>
          <div className="settings-theme-toggle">
            <button
              className={`settings-theme-btn${settings.theme === 'dark' ? ' active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              Dark
            </button>
            <button
              className={`settings-theme-btn${settings.theme === 'light' ? ' active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              Light
            </button>
          </div>
        </div>

        <div className="settings-subsection">
          <label className="settings-label">Accent Color</label>
          <div className="settings-accent-grid">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                className={`settings-accent-btn${settings.accent === c.value ? ' active' : ''}`}
                style={{ '--swatch': c.hex } as React.CSSProperties}
                onClick={() => setAccent(c.value)}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Data</h3>
        <p className="settings-desc">Export your data as a JSON file for backup. Import a previously exported file to restore.</p>
        <div className="settings-data-actions">
          <button className="settings-data-btn" onClick={exportData}>
            Export Data
          </button>
          <button className="settings-data-btn" onClick={() => fileRef.current?.click()}>
            Import Data
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={importData}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="settings-section settings-danger">
        <h3 className="settings-section-title">Danger Zone</h3>
        <p className="settings-desc">Permanently delete all data across your entire account.</p>
        <button className="settings-clear-btn" onClick={clearAllData}>
          Clear All Data
        </button>
      </div>
    </div>
  )
}
