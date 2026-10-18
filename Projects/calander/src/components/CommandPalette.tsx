import { useState, useEffect, useRef, useCallback } from 'react'
import './CommandPalette.css'
import type { AppSettings } from '../themes'

type Tab = 'todo' | 'calendar' | 'pomodoro' | 'habit' | 'log' | 'settings'

interface Command {
  id: string
  label: string
  category: string
  keywords: string
  icon: string
  hint: string
  action: () => void
}

interface CommandPaletteProps {
  onTabChange: (tab: Tab) => void
  settings: AppSettings
  onSettingsChange: (s: AppSettings | ((prev: AppSettings) => AppSettings)) => void
  collapsed: boolean
  onToggleSidebar: () => void
}

function CmdIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    todo: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    pomodoro: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    habits: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    log: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    theme: <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>,
    sidebar: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></>,
  }
  const paths = icons[name]
  return (
    <svg className="cmd-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </svg>
  )
}

export default function CommandPalette({ onTabChange, settings, onSettingsChange, collapsed, onToggleSidebar }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: Command[] = [
    { id: 'todo', label: 'Go to Todo', category: 'Navigate', keywords: 'todo tasks kanban board', icon: 'todo', hint: '', action: () => { onTabChange('todo'); setOpen(false) } },
    { id: 'calendar', label: 'Go to Calendar', category: 'Navigate', keywords: 'calendar events schedule', icon: 'calendar', hint: '', action: () => { onTabChange('calendar'); setOpen(false) } },
    { id: 'pomodoro', label: 'Go to Pomodoro', category: 'Navigate', keywords: 'pomodoro timer focus', icon: 'pomodoro', hint: '', action: () => { onTabChange('pomodoro'); setOpen(false) } },
    { id: 'habits', label: 'Go to Habits', category: 'Navigate', keywords: 'habits tracker streak', icon: 'habits', hint: '', action: () => { onTabChange('habit'); setOpen(false) } },
    { id: 'log', label: 'Go to Logs', category: 'Navigate', keywords: 'logs points history activity', icon: 'log', hint: '', action: () => { onTabChange('log'); setOpen(false) } },
    { id: 'settings', label: 'Go to Settings', category: 'Navigate', keywords: 'settings preferences theme', icon: 'settings', hint: '', action: () => { onTabChange('settings'); setOpen(false) } },
    { id: 'theme', label: `Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`, category: 'Settings', keywords: 'theme dark light toggle', icon: 'theme', hint: '', action: () => { onSettingsChange(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' })); setOpen(false) } },
    { id: 'sidebar', label: `${collapsed ? 'Expand' : 'Collapse'} sidebar`, category: 'Settings', keywords: 'sidebar toggle expand collapse nav', icon: 'sidebar', hint: '', action: () => { onToggleSidebar(); setOpen(false) } },
  ]

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIdx(0)
    setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  const execute = useCallback((idx: number) => {
    if (idx >= 0 && idx < filtered.length) {
      filtered[idx].action()
    }
  }, [filtered])

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault()
        setOpen(prev => !prev)
        return
      }
      if (!open) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(prev => Math.min(prev + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        execute(selectedIdx)
        return
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, filtered.length, selectedIdx, execute])

  useEffect(() => {
    if (!open || !listRef.current) return
    const items = listRef.current.querySelectorAll('.cmd-item')
    const el = items[selectedIdx] as HTMLElement | undefined
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx, open])

  if (!open) return null

  let lastCategory = ''
  return (
    <div className="cmd-overlay" onMouseDown={() => setOpen(false)}>
      <div className="cmd-modal" onMouseDown={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
        />
        <div className="cmd-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmd-empty">No matching commands</div>}
          {filtered.map((cmd, i) => {
            const showCategory = cmd.category !== lastCategory
            lastCategory = cmd.category
            return (
              <div key={cmd.id}>
                {showCategory && <div className="cmd-category">{cmd.category}</div>}
                <div
                  className={`cmd-item${i === selectedIdx ? ' selected' : ''}`}
                  onMouseDown={() => cmd.action()}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <CmdIcon name={cmd.icon} />
                  <span className="cmd-item-label">{cmd.label}</span>
                  {cmd.hint && <span className="cmd-item-hint">{cmd.hint}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
