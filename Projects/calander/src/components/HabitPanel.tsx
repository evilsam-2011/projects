import { useState, useEffect } from 'react'
import './HabitPanel.css'

export type HabitType = 'make' | 'break'
export type HabitPriority = 'low' | 'medium' | 'high'

export interface Habit {
  id: string
  name: string
  type: HabitType
  priority: HabitPriority
  dates: string[]
}

const PRIORITY_POINTS: Record<HabitPriority, number> = { low: 5, medium: 10, high: 20 }
const STORAGE_KEY = 'calander-habits'
const DAYS_TOTAL = 21

function dateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDayWindow(): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = DAYS_TOTAL - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(dateStr(d))
  }
  return days
}

function computeStreak(dates: string[]): number {
  const set = new Set(dates)
  let streak = 0
  const today = new Date()
  for (let i = 0; i < DAYS_TOTAL; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (set.has(dateStr(d))) streak++
    else break
  }
  return streak
}

function loadHabits(): Habit[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

interface HabitPanelProps {
  onHabitComplete: (reason: string, points: number) => void
}

export default function HabitPanel({ onHabitComplete }: HabitPanelProps) {
  const [habits, setHabits] = useState<Habit[]>(loadHabits)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<HabitType>('make')
  const [formPriority, setFormPriority] = useState<HabitPriority>('medium')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
  }, [habits])

  const dayWindow = getDayWindow()
  const today = dateStr(new Date())

  function addHabit() {
    if (!formName.trim()) return
    setHabits(prev => [...prev, { id: crypto.randomUUID(), name: formName.trim(), type: formType, priority: formPriority, dates: [] }])
    setFormName('')
    setShowForm(false)
  }

  function deleteHabit(id: string) {
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  function toggleDate(id: string, date: string) {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h
      const done = h.dates.includes(date)
      const nextDates = done ? h.dates.filter(d => d !== date) : [...h.dates, date]
      if (!done && date === today) {
        onHabitComplete(`Habit: "${h.name}"`, PRIORITY_POINTS[h.priority])
      }
      return { ...h, dates: nextDates }
    }))
  }

  function resetHabit(id: string) {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, dates: [] } : h))
  }

  return (
    <div className="habit-panel">
      <div className="habit-header">
        <h2>Habits</h2>
        <button className="habit-add-btn" onClick={() => setShowForm(true)}>+ Add Habit</button>
      </div>

      {showForm && (
        <div className="habit-form">
          <input
            className="habit-form-input"
            type="text"
            placeholder="Habit name"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addHabit()}
            autoFocus
          />
          <div className="habit-form-row">
            <button
              className={`habit-type-btn${formType === 'make' ? ' active' : ''}`}
              onClick={() => setFormType('make')}
            >Make</button>
            <button
              className={`habit-type-btn${formType === 'break' ? ' active' : ''}`}
              onClick={() => setFormType('break')}
            >Break</button>
          </div>
          <div className="habit-form-row">
            {(['low', 'medium', 'high'] as HabitPriority[]).map(p => (
              <button
                key={p}
                className={`habit-priority-btn ${p}${formPriority === p ? ' active' : ''}`}
                onClick={() => setFormPriority(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)} (+{PRIORITY_POINTS[p]})
              </button>
            ))}
          </div>
          <div className="habit-form-actions">
            <button className="habit-form-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="habit-form-save" onClick={addHabit}>Add</button>
          </div>
        </div>
      )}

      <div className="habit-list">
        {habits.length === 0 && <div className="habit-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              No habits yet — add one to start tracking
            </div>}
        {habits.map(h => {
          const dateSet = new Set(h.dates)
          const completed = h.dates.filter(d => dayWindow.includes(d)).length
          const streak = computeStreak(h.dates)
          return (
            <div key={h.id} className={`habit-card ${h.type}`}>
              <div className="habit-card-top">
                <span className="habit-name">{h.name}</span>
                <span className={`habit-type-badge ${h.type}`}>{h.type === 'make' ? 'Build' : 'Quit'}</span>
                <span className={`habit-priority-badge ${h.priority}`}>+{PRIORITY_POINTS[h.priority]}</span>
              </div>

              <div className="habit-grid">
                {dayWindow.map((ds, i) => {
                  const d = new Date(ds + 'T12:00:00')
                  const num = d.getDate()
                  const marked = dateSet.has(ds)
                  const isToday = ds === today
                  const dayName = d.toLocaleDateString('en', { weekday: 'short' })
                  const label = i < 7 ? dayName : ''
                  return (
                    <button
                      key={ds}
                      className={`habit-day${marked ? ' marked' : ''}${isToday ? ' today' : ''}`}
                      onClick={() => toggleDate(h.id, ds)}
                      title={`${h.type === 'make' ? 'Followed' : 'Broke'} on ${ds}`}
                    >
                      <span className="habit-day-num">{num}</span>
                      {label && <span className="habit-day-name">{label}</span>}
                    </button>
                  )
                })}
              </div>

              <div className="habit-card-mid">
                <div className="habit-progress-bar">
                  <div className="habit-progress-fill" style={{ width: `${(completed / DAYS_TOTAL) * 100}%` }} />
                </div>
                <span className={`habit-progress-text ${completed >= DAYS_TOTAL ? 'done' : ''}`}>
                  {completed}/{DAYS_TOTAL}
                </span>
                <span className="habit-streak">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  {streak}
                </span>
              </div>

              <div className="habit-card-actions">
                <button className="habit-reset-btn" onClick={() => resetHabit(h.id)} title="Reset all">↺ Reset</button>
                <button className="habit-del-btn" onClick={() => deleteHabit(h.id)} title="Delete habit">× Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
