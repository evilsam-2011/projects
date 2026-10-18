import { useState, useEffect, useRef } from 'react'
import './PomodoroPanel.css'
import type { Todo } from './TodoPanel'
import { POINTS_DOING, POINTS_DONE } from './TodoPanel'
import type { CalendarEvent } from './CalendarPanel'
import { notify } from '../notify'
import { playWorkComplete, playBreakComplete, playStart } from '../sound'

const WORK = 25 * 60
const BREAK = 5 * 60
const STORAGE_KEY = 'calander-pomodoro'

const FOCUS_TIPS = [
  'Single task > multitask',
  'Start before you\'re ready',
  'Quality over quantity',
  'Done is better than perfect',
  'Small steps add up',
  'Your focus is your superpower',
  'One session at a time',
  'Progress, not perfection',
  'You\'re building a habit',
  'Every session counts',
  'Be present, be productive',
  'Momentum beats motivation',
]

interface PomodoroState {
  mode: 'work' | 'break'
  remaining: number
  running: boolean
  startedAt: number | null
  linkedTodoId: string | null
  sessionsToday: number
  sessionDate: string
  dailyGoal: number
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadState(): PomodoroState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      let remaining = parsed.remaining ?? WORK
      let running = parsed.running || false
      if (running && parsed.startedAt && parsed.savedAt) {
        const elapsed = Math.floor((Date.now() - parsed.savedAt) / 1000)
        remaining = Math.max(0, remaining - elapsed)
        if (remaining === 0) {
          running = false
        }
      }
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      return {
        mode: parsed.mode || 'work',
        remaining,
        running,
        startedAt: running ? Date.now() : null,
        linkedTodoId: parsed.linkedTodoId || null,
        sessionsToday: parsed.sessionDate !== today ? 0 : (parsed.sessionsToday || 0),
        sessionDate: today,
        dailyGoal: parsed.dailyGoal || 8,
      }
    }
  } catch {}
  return {
    mode: 'work', remaining: WORK, running: false, startedAt: null, linkedTodoId: null,
    sessionsToday: 0, sessionDate: todayStr(), dailyGoal: 8,
  }
}

function save(state: PomodoroState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }))
}

interface PomodoroPanelProps {
  todos: Todo[]
  setTodos: (todos: Todo[] | ((prev: Todo[]) => Todo[])) => void
  events: CalendarEvent[]
  onPomoComplete: (reason: string) => void
  pomoAutoEvent?: { eventId: string; durationMin: number } | null
  onPomoAutoComplete?: () => void
}

export default function PomodoroPanel({ todos, setTodos, events, onPomoComplete, pomoAutoEvent, onPomoAutoComplete }: PomodoroPanelProps) {
  const [state, setState] = useState<PomodoroState>(loadState)
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * FOCUS_TIPS.length))
  const [celebrating, setCelebrating] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onPomoComplete)
  onCompleteRef.current = onPomoComplete
  const handlePomoCompleteRef = useRef(handlePomoComplete)
  handlePomoCompleteRef.current = handlePomoComplete
  const completedRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const autoModeRef = useRef<{ cyclesRemaining: number } | null>(null)

  // Periodic save for page-reload recovery
  useEffect(() => {
    const id = setInterval(() => {
      save(stateRef.current)
    }, 3000)
    return () => clearInterval(id)
  }, [])

  // Save on unmount (page close / refresh)
  useEffect(() => {
    return () => {
      save(stateRef.current)
    }
  }, [])

  // Auto-start pomodoro from calendar event
  useEffect(() => {
    if (!pomoAutoEvent) return
    const cycles = Math.floor(pomoAutoEvent.durationMin / 30)
    autoModeRef.current = { cyclesRemaining: cycles }
    setState(prev => ({
      ...prev,
      mode: 'work',
      remaining: 25 * 60,
      running: true,
      startedAt: Date.now(),
    }))
  }, [pomoAutoEvent])

  useEffect(() => {
    if (state.running && state.startedAt != null) {
      completedRef.current = false
      const startedAt = state.startedAt
      const initialRemaining = state.remaining
      const linkedTodoId = state.linkedTodoId
      const mode = state.mode
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000
        const currentRemaining = Math.max(0, initialRemaining - elapsed)
        if (currentRemaining <= 0) {
          if (completedRef.current) return
          completedRef.current = true
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          const auto = autoModeRef.current
          if (mode === 'work') {
            if (auto) {
              setState(prev => ({ ...prev, remaining: 0, running: false, startedAt: null }))
              notify('Pomodoro', 'Work session complete — time for a break!')
              playWorkComplete()
              setTimeout(() => {
                setState(prev => ({ ...prev, mode: 'break', remaining: 5 * 60, running: true, startedAt: Date.now() }))
              }, 50)
            } else {
              setState(prev => ({ ...prev, remaining: 0, running: false, startedAt: null }))
              setCelebrating(true)
              setTimeout(() => setCelebrating(false), 800)
              setState(prev => ({ ...prev, sessionsToday: prev.sessionsToday + 1 }))
              setTipIdx(prev => (prev + 1) % FOCUS_TIPS.length)
              notify('Pomodoro', 'Work session complete — time for a break!')
              playWorkComplete()
              handlePomoCompleteRef.current(linkedTodoId)
              setCountdown(5)
            }
          } else {
            if (auto) {
              auto.cyclesRemaining--
              if (auto.cyclesRemaining <= 0) {
                autoModeRef.current = null
                setState(prev => ({ ...prev, running: false, startedAt: null }))
                notify('Pomodoro', 'Session complete!')
                playBreakComplete()
                onPomoAutoComplete?.()
              } else {
                setState(prev => ({ ...prev, running: false, startedAt: null }))
                notify('Pomodoro', 'Break over — ready to focus again!')
                playBreakComplete()
                setTimeout(() => {
                  setState(prev => ({ ...prev, mode: 'work', remaining: 25 * 60, running: true, startedAt: Date.now() }))
                }, 50)
              }
            } else {
              setState(prev => ({ ...prev, remaining: 0, running: false, startedAt: null }))
              notify('Pomodoro', 'Break over — ready to focus again!')
              playBreakComplete()
            }
          }
        } else {
          setState(prev => ({ ...prev, remaining: currentRemaining }))
        }
      }, 250)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state.running])

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      setCountdown(null)
      doToggleMode()
      return
    }
    const id = setTimeout(() => setCountdown(prev => prev !== null ? prev - 1 : null), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  function getDynamicTarget(todoId: string): number {
    const todo = todos.find(t => t.id === todoId)
    if (!todo || !todo.id.startsWith('event-')) return 2
    const eventId = todo.id.slice(6)
    const event = events.find(e => e.id === eventId)
    if (!event) return 2
    const [sh, sm] = event.start.split(':').map(Number)
    const [eh, em] = event.end.split(':').map(Number)
    const durationMin = (eh * 60 + em) - (sh * 60 + sm)
    return Math.max(1, Math.floor(durationMin / 30))
  }

  function handlePomoComplete(linkedTodoId: string | null) {
    const task = linkedTodoId ? todos.find(t => t.id === linkedTodoId) : null
    const reason = task ? `Pomodoro: "${task.text}"` : 'Pomodoro completed'
    onCompleteRef.current(reason)

    if (task) {
      setTodos(prev => prev.map(t => {
        if (t.id !== linkedTodoId) return t
        const newPomodoros = t.pomodoros + 1
        const target = getDynamicTarget(t.id)
        let newStatus = t.status
        if (t.status === 'doing' && newPomodoros >= target) newStatus = 'done'

        let newPoints = t.points
        if (newStatus !== t.status) {
          newPoints = t.status === 'doing' && newStatus === 'done' ? POINTS_DOING + POINTS_DONE : newPoints
        }
        return { ...t, pomodoros: newPomodoros, status: newStatus, points: newPoints, pomoTarget: target }
      }))
    }
  }

  function doStart() {
    playStart()
    setState(prev => {
      const next = { ...prev, running: true, startedAt: Date.now() }
      save(next)
      return next
    })
    if (state.linkedTodoId) {
      setTodos(prev => prev.map(t => {
        if (t.id !== state.linkedTodoId || t.status !== 'todo') return t
        const target = getDynamicTarget(t.id)
        return { ...t, status: 'doing', points: POINTS_DOING, pomoTarget: target }
      }))
    }
  }

  function doPause() {
    autoModeRef.current = null
    setState(prev => {
      const next = { ...prev, running: false, startedAt: null }
      save(next)
      return next
    })
  }

  function doReset() {
    autoModeRef.current = null
    setState(prev => {
      const next = {
        ...prev, running: false,
        remaining: prev.mode === 'work' ? WORK : BREAK,
        startedAt: null,
      }
      save(next)
      return next
    })
    setCountdown(null)
  }

  function doToggleMode() {
    setState(prev => {
      const next: PomodoroState = {
        ...prev,
        mode: prev.mode === 'work' ? 'break' : 'work',
        remaining: prev.mode === 'work' ? BREAK : WORK,
        running: false,
        startedAt: null,
      }
      save(next)
      return next
    })
    setCountdown(null)
  }

  const linkedTask = state.linkedTodoId ? todos.find(t => t.id === state.linkedTodoId && t.status !== 'done') : null
  const availableTasks = todos.filter(t => t.status === 'todo' || t.status === 'doing')

  const duration = state.mode === 'work' ? WORK : BREAK
  const pct = duration > 0 ? ((duration - state.remaining) / duration) * 100 : 0

  function getRingColor(pct: number): string {
    if (state.mode === 'break') return 'var(--green)'
    if (pct > 66) return 'var(--accent)'
    if (pct > 33) return 'var(--amber)'
    return 'var(--red)'
  }

  const minutes = Math.floor(state.remaining / 60)
  const seconds = Math.floor(state.remaining % 60)
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const dots = Array.from({ length: state.dailyGoal }, (_, i) => i < state.sessionsToday)

  const ringColor = getRingColor(pct)
  const dashArray = Math.PI * 2 * 88
  const dashOffset = dashArray * (1 - pct / 100)

  return (
    <div className="pomo-panel">
      <div className="pomo-header">
        <h2>Pomodoro</h2>
        <div className="pomo-sessions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="pomo-session-count">{state.sessionsToday}</span>
          <span className="pomo-session-label">today</span>
        </div>
      </div>

      <div className="pomo-body">
        <div className="pomo-mode-row">
          <div className="pomo-mode-tabs">
            <button
              className={`pomo-mode-tab${state.mode === 'work' ? ' active' : ''}`}
              onClick={() => state.mode !== 'work' && doToggleMode()}
            >Work</button>
            <button
              className={`pomo-mode-tab${state.mode === 'break' ? ' active' : ''}`}
              onClick={() => state.mode !== 'break' && doToggleMode()}
            >Break</button>
          </div>
        </div>

        <div className="pomo-dots-row">
          {dots.map((done, i) => (
            <div key={i} className={`pomo-dot${done ? ' done' : ''}`} />
          ))}
        </div>

        {!state.running && state.mode !== 'break' && (
          <div className="pomo-task-select">
            <label className="pomo-task-label">Focus on task</label>
            <select
              className="pomo-task-select-input"
              value={state.linkedTodoId || ''}
              onChange={e => {
                const id = e.target.value || null
                setState(prev => {
                  const next = { ...prev, linkedTodoId: id }
                  save(next)
                  return next
                })
                if (id) {
                  const target = getDynamicTarget(id)
                  setTodos(prev => prev.map(t => t.id === id ? { ...t, pomoTarget: target } : t))
                }
              }}
            >
              <option value="">None</option>
              {availableTasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.text} ({t.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {linkedTask && (
          <div className="pomo-linked-task">
            <span className="pomo-linked-label">Working on</span>
            <span className="pomo-linked-name">{linkedTask.text}</span>
            <span className="pomo-linked-count">{linkedTask.pomodoros}/{linkedTask.pomoTarget} pomos</span>
          </div>
        )}

        <div className={`pomo-timer${celebrating ? ' celebrating' : ''}`}>
          <svg className="pomo-aura" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="96" />
          </svg>
          <svg className="pomo-ring" viewBox="0 0 200 200">
            <circle className="pomo-ring-bg" cx="100" cy="100" r="88" />
            <circle
              className={`pomo-ring-fill${state.running ? ' running' : ''}${celebrating ? ' celebrate' : ''}`}
              cx="100" cy="100" r="88"
              stroke={ringColor}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 100 100)"
            />
          </svg>
          {countdown !== null ? (
            <div className="pomo-countdown">
              <span className="pomo-countdown-num">{countdown}</span>
              <span className="pomo-countdown-label">break in...</span>
            </div>
          ) : (
            <div className="pomo-time">{display}</div>
          )}
        </div>

        <div className="pomo-tip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span key={tipIdx} className="pomo-tip-text">{FOCUS_TIPS[tipIdx]}</span>
        </div>

        <div className="pomo-controls">
          {!state.running ? (
            <button className="pomo-btn pomo-btn-primary" onClick={doStart} disabled={state.remaining === 0}>
              {state.mode === 'break' ? 'Start Break' : 'Start'}
            </button>
          ) : (
            <button className="pomo-btn pomo-btn-primary" onClick={doPause}>Pause</button>
          )}
          <button className="pomo-btn pomo-btn-secondary" onClick={doReset}>Reset</button>
        </div>
      </div>
    </div>
  )
}
