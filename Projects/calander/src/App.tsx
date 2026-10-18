import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import TodoPanel, { type Todo, type Status, STORAGE_KEY, getPointsForStatus } from './components/TodoPanel'
import CalendarPanel, { type CalendarEvent, type Calendar, CALENDAR_STORAGE_KEY, CALENDARS_KEY } from './components/CalendarPanel'
import LogPanel from './components/LogPanel'
import PomodoroPanel from './components/PomodoroPanel'
import HabitPanel from './components/HabitPanel'
import SettingsPanel from './components/SettingsPanel'
import CommandPalette from './components/CommandPalette'
import { notify, requestNotificationPermission } from './notify'
import { loadSettings, applySettings, SETTINGS_KEY, type AppSettings } from './themes'
import './App.css'

type Tab = 'todo' | 'calendar' | 'pomodoro' | 'habit' | 'log' | 'settings'

const EVENT_TODO_PREFIX = 'event-'

function computeEventStatus(event: CalendarEvent): Status {
  const now = new Date()
  const today = dateStr(now)

  let targetDate: string
  if (event.daily) {
    targetDate = today
  } else {
    targetDate = event.date
  }

  const start = new Date(`${targetDate}T${event.start}`)
  const end = new Date(`${targetDate}T${event.end}`)

  if (now < start) return 'todo'
  if (now >= end) return 'done'
  return 'doing'
}

function dateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface PointLog {
  id: string
  timestamp: string
  points: number
  reason: string
  todoId?: string
}

const LOGS_KEY = 'calander-point-logs'

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(() => {
    const s = loadSettings()
    applySettings(s)
    return s
  })
  const [activeTab, setActiveTab] = useState<Tab>('todo')
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      return parsed.map((t: any) => ({
        ...t,
        status: t.status || (t.done ? 'done' : 'todo'),
        created: t.created || todayStr,
        subtasks: t.subtasks || [],
        pomodoros: t.pomodoros || 0,
        pomoTarget: t.pomoTarget || 2,
        dueDate: t.dueDate || undefined,
        order: t.order ?? 0,
      }))
    } catch {
      return []
    }
  })
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem(CALENDAR_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [calendars, setCalendars] = useState<Calendar[]>(() => {
    try {
      const saved = localStorage.getItem(CALENDARS_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return [{ id: 'default', name: 'Default', color: '#6366f1', visible: true }]
  })
  const logsInitializedRef = useRef(false)
  const [logs, setLogs] = useState<PointLog[]>(() => {
    try {
      const saved = localStorage.getItem(LOGS_KEY)
      if (saved !== null) {
        logsInitializedRef.current = true
        return JSON.parse(saved)
      }
      return []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events))
  }, [events])

  useEffect(() => {
    localStorage.setItem(CALENDARS_KEY, JSON.stringify(calendars))
  }, [calendars])

  useEffect(() => {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs))
  }, [logs])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    applySettings(settings)
  }, [settings])

  useEffect(() => { requestNotificationPermission() }, [])

  const notifiedEventIds = useRef<Set<string>>(new Set())
  const [pomoAutoEvent, setPomoAutoEvent] = useState<{ eventId: string; durationMin: number } | null>(null)
  const startedPomoEventIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      const in5min = new Date(now.getTime() + 5 * 60000)
      const today = dateStr(now)
      for (const event of events) {
        const eventDate = event.daily ? today : event.date
        const eventStart = new Date(`${eventDate}T${event.start}`)
        if (eventStart > now && eventStart <= in5min && !notifiedEventIds.current.has(event.id)) {
          notifiedEventIds.current.add(event.id)
          const [h, m] = event.start.split(':').map(Number)
          const ampm = h >= 12 ? 'PM' : 'AM'
          const h12 = h % 12 || 12
          notify('Calendar', `${event.name} starts at ${h12}:${String(m).padStart(2, '0')} ${ampm}`)
        }
        if (event.pomodoro && !startedPomoEventIds.current.has(event.id)) {
          const eventEnd = new Date(`${eventDate}T${event.end}`)
          if (now >= eventStart && now <= eventEnd) {
            startedPomoEventIds.current.add(event.id)
            const durationMs = eventEnd.getTime() - eventStart.getTime()
            const durationMin = Math.round(durationMs / 60000)
            if (durationMin >= 30 && durationMin % 30 === 0) {
              setPomoAutoEvent({ eventId: event.id, durationMin })
            }
          }
        }
      }
    }, 30000)
    return () => clearInterval(id)
  }, [events])

  // Migrate old events without calendarId
  useEffect(() => {
    if (calendars.length > 0) {
      setEvents(prev => {
        let changed = false
        const next = prev.map(e => {
          if (!e.calendarId) {
            changed = true
            return { ...e, calendarId: calendars[0].id }
          }
          return e
        })
        return changed ? next : prev
      })
    }
  }, [calendars])

  const syncTodosFromEvents = useCallback((currentEvents: CalendarEvent[]) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setTodos(prev => {
      const trackedEvents = currentEvents.filter(e => e.syncToTodo !== false)
      const eventIds = new Set(trackedEvents.map(e => EVENT_TODO_PREFIX + e.id))
      const kept = prev.filter(t => !t.id.startsWith(EVENT_TODO_PREFIX) || eventIds.has(t.id))
      for (const event of trackedEvents) {
        const todoId = EVENT_TODO_PREFIX + event.id
        const existing = kept.find(t => t.id === todoId)
        const computedStatus = computeEventStatus(event)
        const created = event.daily ? todayStr : event.date
          if (existing) {
          const idx = kept.indexOf(existing)
          kept[idx] = {
            ...existing,
            text: event.name,
            status: computedStatus,
            daily: event.daily,
            created,
            points: getPointsForStatus(computedStatus),
          }
        } else {
          kept.push({
            id: todoId,
            text: event.name,
            status: computedStatus,
            daily: event.daily,
            points: getPointsForStatus(computedStatus),
            created,
            subtasks: [],
            pomodoros: 0,
            pomoTarget: 2,
            order: 0,
          })
        }
      }
      return kept
    })
  }, [])

  useEffect(() => {
    syncTodosFromEvents(events)
  }, [events, syncTodosFromEvents])

  useEffect(() => {
    const id = setInterval(() => {
      setTodos(prev => {
        let changed = false
        const next = prev.map(t => {
          if (!t.id.startsWith(EVENT_TODO_PREFIX)) return t
          const eventId = t.id.slice(EVENT_TODO_PREFIX.length)
          const event = (JSON.parse(localStorage.getItem(CALENDAR_STORAGE_KEY) || '[]') as CalendarEvent[])
            .find((e: CalendarEvent) => e.id === eventId)
          if (!event || event.syncToTodo === false) return t
          const computedStatus = computeEventStatus(event)
          if (t.status !== computedStatus) {
            changed = true
            return {
              ...t,
              status: computedStatus,
              points: getPointsForStatus(computedStatus),
            }
          }
          return t
        })
        return changed ? next : prev
      })
    }, 30000)
    return () => clearInterval(id)
  }, [])

  const prevTodosRef = useRef<Todo[]>([])
  const migratedRef = useRef(false)

  useEffect(() => {
    if (!migratedRef.current) {
      migratedRef.current = true
      if (!logsInitializedRef.current && logs.length === 0) {
        const initial: PointLog[] = []
        for (const t of todos) {
          if (t.points > 0) {
            initial.push({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              points: t.points,
              reason: t.status === 'done' ? `Completed task: "${t.text}"` : `Started task: "${t.text}"`,
              todoId: t.id,
            })
          }
        }
        if (initial.length > 0) {
          logsInitializedRef.current = true
          setLogs(initial)
        }
      }
      prevTodosRef.current = todos
      return
    }

    const prev = prevTodosRef.current
    const newLogs: PointLog[] = []
    for (const todo of todos) {
      const prevTodo = prev.find(t => t.id === todo.id)
      const prevPoints = prevTodo?.points ?? 0
      if (todo.points > prevPoints) {
        const earned = todo.points - prevPoints
        const ts = new Date().toISOString()
        if (earned >= 40) {
          newLogs.push({
            id: crypto.randomUUID(), timestamp: ts, points: 10,
            reason: `Started task: "${todo.text}"`, todoId: todo.id,
          })
          newLogs.push({
            id: crypto.randomUUID(), timestamp: ts, points: 30,
            reason: `Completed task: "${todo.text}"`, todoId: todo.id,
          })
        } else {
          const label = earned >= 30 ? 'Completed' : 'Started'
          newLogs.push({
            id: crypto.randomUUID(), timestamp: ts, points: earned,
            reason: `${label} task: "${todo.text}"`,
            todoId: todo.id,
          })
        }
      } else if (todo.points < prevPoints) {
        const lost = prevPoints - todo.points
        newLogs.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          points: -lost,
          reason: `Removed points for: "${todo.text}"`,
          todoId: todo.id,
        })
      }
    }
    if (newLogs.length > 0) {
      setLogs(prev => [...newLogs, ...prev])
    }
    prevTodosRef.current = todos
  }, [todos, logs.length])

  function deleteLog(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const todayStr = dateStr(new Date())
  const totalPoints = logs
    .filter(l => dateStr(new Date(l.timestamp)) === todayStr)
    .reduce((sum, l) => sum + l.points, 0)

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={collapsed}
        onToggle={() => setCollapsed(prev => !prev)}
        totalPoints={totalPoints}
      />
      <main className="main-area">
        {activeTab === 'todo' && <TodoPanel todos={todos} setTodos={setTodos} events={events} />}
        {activeTab === 'calendar' && <CalendarPanel events={events} setEvents={setEvents} calendars={calendars} setCalendars={setCalendars} todos={todos} />}
        <div className={activeTab === 'pomodoro' ? '' : 'panel-hidden'}>
          <PomodoroPanel
            todos={todos}
            setTodos={setTodos}
            events={events}
            onPomoComplete={(reason) => {
              setLogs(prev => [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), points: 5, reason }, ...prev])
            }}
            pomoAutoEvent={pomoAutoEvent}
            onPomoAutoComplete={() => setPomoAutoEvent(null)}
          />
        </div>
        {activeTab === 'habit' && <HabitPanel onHabitComplete={(reason, points) => {
          setLogs(prev => [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), points, reason }, ...prev])
        }} />}
        {activeTab === 'log' && <LogPanel logs={logs} onDelete={deleteLog} />}
        {activeTab === 'settings' && <SettingsPanel settings={settings} onSettingsChange={setSettings} />}
      </main>
      <CommandPalette
        onTabChange={setActiveTab}
        settings={settings}
        onSettingsChange={setSettings}
        collapsed={collapsed}
        onToggleSidebar={() => setCollapsed(prev => !prev)}
      />
    </div>
  )
}

export default App