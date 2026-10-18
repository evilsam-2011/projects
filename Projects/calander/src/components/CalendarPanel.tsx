import { useState, useEffect, useRef } from 'react'
import './CalendarPanel.css'
import type { Todo } from './TodoPanel'

export interface Calendar {
  id: string
  name: string
  color: string
  visible: boolean
}

export type RepeatType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'weekdays'

export interface CalendarEvent {
  id: string
  date: string
  name: string
  start: string
  end: string
  details: string
  daily: boolean
  calendarId: string
  syncToTodo?: boolean
  repeat?: RepeatType
  pomodoro?: boolean
}

export const CALENDAR_STORAGE_KEY = 'calander-events'
export const CALENDARS_KEY = 'calander-calendars'

const CALENDAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatTimeDisplay(hour: number) {
  const h12 = hour % 12 || 12
  return `${h12}:00`
}

function format12(time: string) {
  const [h, m] = time.split(':').map(Number)
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')}`
}

function ampmLabel(time: string) {
  const h = Number(time.split(':')[0])
  return h >= 12 ? 'PM' : 'AM'
}

function dateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

interface CalendarPanelProps {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => void
  calendars: Calendar[]
  setCalendars: (calendars: Calendar[] | ((prev: Calendar[]) => Calendar[])) => void
  todos: Todo[]
}

export default function CalendarPanel({ events, setEvents, calendars, setCalendars, todos }: CalendarPanelProps) {
  const today = new Date()
  const [focusDate, setFocusDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formDate, setFormDate] = useState('')
  const [formName, setFormName] = useState('')
  const [formStart, setFormStart] = useState('09:00')
  const [formEnd, setFormEnd] = useState('10:00')
  const [formDetails, setFormDetails] = useState('')
  const [formPomodoro, setFormPomodoro] = useState(false)
  const [formCalendarId, setFormCalendarId] = useState('')
  const [formSyncToTodo, setFormSyncToTodo] = useState(true)
  const [formRepeat, setFormRepeat] = useState<RepeatType>('none')
  const [showCalManager, setShowCalManager] = useState(false)
  const [showCalPicker, setShowCalPicker] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(focusDate.getFullYear())
  const [pickerMonth, setPickerMonth] = useState(focusDate.getMonth())
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(new Date())
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    type: 'move' | 'resize'
    eventId: string
    startY: number
    origStartMin: number
    origEndMin: number
    origDate: string
    minDuration: number
  } | null>(null)
  const didDrag = useRef(false)

  function snapMins(m: number) { return Math.round(m / 15) * 15 }

  function minsToStr(m: number) {
    const clamped = Math.max(0, Math.min(1440, m))
    const h = Math.floor(clamped / 60)
    const min = clamped % 60
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  const DAYS_RANGE = 60
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const startDate = focusDate < todayStart ? todayStart : focusDate
  const visibleDays = Array.from({ length: DAYS_RANGE }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    return d
  })

  const rangeEnd = visibleDays[visibleDays.length - 1]
  const weekLabel = `${MONTHS[startDate.getMonth()].slice(0, 3)} ${startDate.getDate()} – ${MONTHS[rangeEnd.getMonth()].slice(0, 3)} ${rangeEnd.getDate()}, ${rangeEnd.getFullYear()}`

  useEffect(() => {
    setPickerYear(focusDate.getFullYear())
    setPickerMonth(focusDate.getMonth())
  }, [focusDate])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showForm) setShowForm(false)
        if (showPicker) setShowPicker(false)
        if (showCalPicker) setShowCalPicker(false)
        if (showCalManager) setShowCalManager(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showForm, showPicker, showCalPicker, showCalManager])

  useEffect(() => {
    function handleMouseMove(e: globalThis.MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const deltaY = e.clientY - drag.startY
      if (Math.abs(deltaY) > 3) didDrag.current = true
      const deltaMins = Math.round(deltaY / PX_PER_MIN)
      if (drag.type === 'move') {
        const newStart = snapMins(drag.origStartMin + deltaMins)
        const newEnd = snapMins(drag.origEndMin + deltaMins)
        if (newStart < 0 || newEnd > 1440) return
        setEvents(prev => prev.map(ev =>
          ev.id === drag.eventId
            ? { ...ev, start: minsToStr(newStart), end: minsToStr(newEnd) }
            : ev
        ))
      } else {
        const newEnd = snapMins(drag.origEndMin + deltaMins)
        const minEnd = drag.origStartMin + drag.minDuration
        if (newEnd < minEnd || newEnd > 1440) return
        setEvents(prev => prev.map(ev =>
          ev.id === drag.eventId
            ? { ...ev, end: minsToStr(newEnd) }
            : ev
        ))
      }
    }
    function handleMouseUp() {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setTimeout(() => { didDrag.current = false }, 0)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  function handleEventMouseDown(e: React.MouseEvent, eventId: string, start: string, end: string, date: string) {
    if ((e.target as HTMLElement).closest('.cal-week-event-del, .cal-event-resize-handle')) return
    didDrag.current = false
    e.preventDefault()
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    dragRef.current = {
      type: 'move',
      eventId,
      startY: e.clientY,
      origStartMin: sh * 60 + sm,
      origEndMin: eh * 60 + em,
      origDate: date,
      minDuration: 15,
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  function handleResizeMouseDown(e: React.MouseEvent, eventId: string, start: string, end: string) {
    e.preventDefault()
    e.stopPropagation()
    didDrag.current = false
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    dragRef.current = {
      type: 'resize',
      eventId,
      startY: e.clientY,
      origStartMin: sh * 60 + sm,
      origEndMin: eh * 60 + em,
      origDate: '',
      minDuration: 15,
    }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  function scrollDays(amount: number) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + amount)
    setFocusDate(d)
  }

  function goToToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setFocusDate(d)
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  function handleSlotClick(day: Date, hour: number) {
    const start = `${String(hour).padStart(2, '0')}:00`
    const endHour = hour + 1 < 24 ? hour + 1 : 23
    const end = `${String(endHour).padStart(2, '0')}:00`
    setEditId(null)
    setFormDate(dateStr(day))
    setFormStart(start)
    setFormEnd(end)
    setFormName('')
    setFormDetails('')
    setFormPomodoro(false)
    setFormCalendarId(calendars.length > 0 ? calendars[0].id : '')
    setFormSyncToTodo(true)
    setFormRepeat('none')
    setShowForm(true)
  }

  function handleEditEvent(e: CalendarEvent, day: Date) {
    setEditId(e.id)
    setFormDate(dateStr(day))
    setFormName(e.name)
    setFormStart(e.start)
    setFormEnd(e.end)
    setFormDetails(e.details)
    setFormPomodoro(e.pomodoro || false)
    setFormCalendarId(e.calendarId || (calendars.length > 0 ? calendars[0].id : ''))
    setFormSyncToTodo(e.syncToTodo !== false)
    setFormRepeat(e.daily && (!e.repeat || e.repeat === 'none') ? 'daily' : (e.repeat || 'none'))
    setShowForm(true)
  }

  function addEvent() {
    if (!formName.trim() || !formDate) return
    if (editId) {
      setEvents(prev =>
        prev.map(ev =>
          ev.id === editId
            ? { ...ev, name: formName.trim(), start: formStart, end: formEnd, details: formDetails.trim(), daily: formRepeat === 'daily', calendarId: formCalendarId, syncToTodo: formSyncToTodo, repeat: formRepeat, pomodoro: formPomodoro }
            : ev
        )
      )
      setToast('Event updated')
    } else {
      const event: CalendarEvent = {
        id: crypto.randomUUID(),
        date: formDate,
        name: formName.trim(),
        start: formStart,
        end: formEnd,
        details: formDetails.trim(),
        daily: formRepeat === 'daily',
        calendarId: formCalendarId,
        syncToTodo: formSyncToTodo,
        repeat: formRepeat,
        pomodoro: formPomodoro,
      }
      setEvents(prev => [...prev, event])
      setToast('Event added')
    }
    setShowForm(false)
    setEditId(null)
  }

  function deleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id))
    setToast('Event deleted')
  }

  function getEventsForDate(date: Date): CalendarEvent[] {
    const ds = dateStr(date)
    return events.filter(e => {
      if ((!e.calendarId || visibleCalendarIds.has(e.calendarId)) === false) return false
      if (e.date === ds || e.daily || e.repeat === 'daily') return true
      if (!e.repeat || e.repeat === 'none') return false
      if (ds < e.date) return false
      const eventDate = new Date(e.date + 'T12:00:00')
      const diffDays = Math.round((date.getTime() - eventDate.getTime()) / 86400000)
      switch (e.repeat) {
        case 'weekly': return diffDays % 7 === 0
        case 'biweekly': return diffDays % 14 === 0
        case 'monthly': return date.getDate() === eventDate.getDate()
        case 'weekdays': return date.getDay() >= 1 && date.getDay() <= 6
        default: return false
      }
    })
  }

  const visibleCalendarIds = new Set(calendars.filter(c => c.visible).map(c => c.id))
  const calendarColorMap = new Map(calendars.map(c => [c.id, c.color]))

  const SLOT_HEIGHT = 48
  const MINUTES_PER_SLOT = 60
  const PX_PER_MIN = SLOT_HEIGHT / MINUTES_PER_SLOT

  function eventTopOffset(time: string) {
    const [h, m] = time.split(':').map(Number)
    return (h * 60 + m) * PX_PER_MIN
  }

  function eventHeight(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    return Math.max(((eh * 60 + em) - (sh * 60 + sm)) * PX_PER_MIN, 18)
  }

  // Month picker
  const { firstDay, daysInMonth } = getMonthDays(pickerYear, pickerMonth)
  const pickerCells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) pickerCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) pickerCells.push(d)

  function pickerPrevMonth() {
    setPickerMonth(prev => {
      if (prev === 0) { setPickerYear(y => y - 1); return 11 }
      return prev - 1
    })
  }

  function pickerNextMonth() {
    setPickerMonth(prev => {
      if (prev === 11) { setPickerYear(y => y + 1); return 0 }
      return prev + 1
    })
  }

  function pickDate(day: number) {
    const d = new Date(pickerYear, pickerMonth, day)
    d.setHours(0, 0, 0, 0)
    setFocusDate(d)
    setShowPicker(false)
  }

  return (
    <div className="cal-panel">
      <div className="cal-topbar">
        <div className="cal-topbar-left">
          <button className="cal-nav" onClick={() => scrollDays(-14)} aria-label="Scroll left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="cal-nav" onClick={() => scrollDays(14)} aria-label="Scroll right">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <span className="cal-week-label">{weekLabel}</span>
        </div>
        <div className="cal-topbar-right">
          <button className="cal-top-btn" onClick={goToToday}>Today</button>
          <button className="cal-top-btn cal-icon-btn" onClick={() => setShowPicker(true)} title="Pick date">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        </div>
      </div>

      <div className="cal-calendars">
        {calendars.map(cal => (
          <div key={cal.id} className="cal-calendar-pill">
            <span className="cal-cal-dot" style={{ background: cal.color }} />
            <span className="cal-cal-name">{cal.name}</span>
            <button
              className="cal-cal-toggle"
              onClick={() => setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, visible: !c.visible } : c))}
              title={cal.visible ? 'Hide' : 'Show'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {cal.visible
                  ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                  : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                }
              </svg>
            </button>
            {calendars.length > 1 && (
              <button className="cal-cal-del" onClick={() => setCalendars(prev => prev.filter(c => c.id !== cal.id))} title="Delete calendar">×</button>
            )}
          </div>
        ))}
        <button className="cal-cal-add" onClick={() => setShowCalManager(true)} title="Add calendar">+</button>
      </div>

      {showCalManager && (
        <NewCalendarDialog
          onAdd={(name, color) => {
            setCalendars(prev => [...prev, { id: crypto.randomUUID(), name, color, visible: true }])
            setShowCalManager(false)
          }}
          onClose={() => setShowCalManager(false)}
        />
      )}

      <div className="cal-week-scroll" ref={scrollRef}>
        {events.length === 0 && <div className="cal-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <line x1="8" y1="14" x2="8" y2="18" />
                      <line x1="12" y1="14" x2="12" y2="18" />
                      <line x1="16" y1="14" x2="16" y2="18" />
                    </svg>
                    <p>No events — click a time slot to add one</p>
                  </div>}
        <div className="cal-week-body">
          <div className="cal-time-col">
            <div className="cal-time-header" />
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="cal-time-label">
                <span>{`${formatTimeDisplay(i)} ${i >= 12 ? 'PM' : 'AM'}`}</span>
              </div>
            ))}
          </div>

          {visibleDays.map((day, di) => {
            const dayEvents = getEventsForDate(day)
            const isTodayDay = isSameDay(day, today)
            return (
              <div key={di} className="cal-day-col">
                <div className={`cal-day-col-header ${isTodayDay ? 'today' : ''}`}>
                  <span className="cal-day-col-name">{DAYS[day.getDay()]}</span>
                  <span className={`cal-day-col-num ${isTodayDay ? 'today' : ''}`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="cal-day-todos">
                  {todos.filter(t => t.dueDate === dateStr(day) && t.status !== 'done').map(t => (
                    <span key={t.id} className={`cal-day-todo ${t.status === 'doing' ? 'doing' : ''}`} title={t.text}>
                      {t.text}
                    </span>
                  ))}
                </div>
                <div className="cal-day-col-slots">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className="cal-week-slot"
                      onClick={() => handleSlotClick(day, hour)}
                    >
                      <span className="cal-week-slot-plus">+</span>
                    </div>
                  ))}
                    {dayEvents.map(e => {
                    const top = eventTopOffset(e.start)
                    const height = eventHeight(e.start, e.end)
                    const calColor = calendarColorMap.get(e.calendarId) || 'var(--accent)'
                    return (
                      <div
                        key={e.id}
                        className="cal-week-event"
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onMouseDown={ev => handleEventMouseDown(ev, e.id, e.start, e.end, dateStr(day))}
                        onClick={ev => { if (didDrag.current) return; ev.stopPropagation(); handleEditEvent(e, day); }}
                      >
                        <div className="cal-week-event-inner" style={{ background: calColor }}>
                          <span className="cal-week-event-name">{e.name}</span>
                          <span className="cal-week-event-time">{format12(e.start)} <span className="cal-ampm-sm">{ampmLabel(e.start)}</span> – {format12(e.end)} <span className="cal-ampm-sm">{ampmLabel(e.end)}</span></span>
                          <button
                            className="cal-week-event-del"
                            onClick={ev => { ev.stopPropagation(); deleteEvent(e.id); }}
                          >
                            ×
                          </button>
                        </div>
                        {height >= 32 && (
                          <div
                            className="cal-event-resize-handle"
                            onMouseDown={ev => handleResizeMouseDown(ev, e.id, e.start, e.end)}
                          />
                        )}
                      </div>
                    )
                  })}
                  {isTodayDay && (() => {
                    const nowTop = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MIN
                    return <div className="cal-now-line" style={{ top: `${nowTop}px` }} />
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {toast && <div className="cal-toast">{toast}</div>}

      {/* Event form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h4>{editId ? 'Edit Event' : 'New Event'}</h4>
            <input
              className="cal-form-input"
              type="text"
              placeholder="Event name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              autoFocus
            />
            <div className="cal-form-row">
              <label className="cal-form-label">Start</label>
              <input
                className="cal-form-input cal-form-time"
                type="time"
                value={formStart}
                onChange={e => setFormStart(e.target.value)}
              />
              <label className="cal-form-label">End</label>
              <input
                className="cal-form-input cal-form-time"
                type="time"
                value={formEnd}
                onChange={e => setFormEnd(e.target.value)}
              />
            </div>
            <div className="cal-form-row cal-form-toggles">
              <label className="cal-toggle">
                <span className="cal-toggle-label">Pomodoro</span>
                <span className={`cal-toggle-switch ${formPomodoro ? 'on' : ''}`} onClick={() => setFormPomodoro(prev => !prev)}>
                  <span className="cal-toggle-track" />
                  <span className="cal-toggle-thumb" />
                  <span className="cal-toggle-text">{formPomodoro ? 'ON' : 'OFF'}</span>
                </span>
              </label>
              <label className="cal-toggle">
                <span className="cal-toggle-label">Track in todo</span>
                <span className={`cal-toggle-switch ${formSyncToTodo ? 'on' : ''}`} onClick={() => setFormSyncToTodo(prev => !prev)}>
                  <span className="cal-toggle-track" />
                  <span className="cal-toggle-thumb" />
                  <span className="cal-toggle-text">{formSyncToTodo ? 'ON' : 'OFF'}</span>
                </span>
              </label>
            </div>
            <div className="cal-form-row">
              <label className="cal-form-label">Calendar</label>
              <div className="cal-cal-select">
                <button
                  className="cal-cal-select-btn"
                  onClick={() => setShowCalPicker(prev => !prev)}
                >
                  {formCalendarId && <span className="cal-cal-dot-sm" style={{ background: calendarColorMap.get(formCalendarId) || 'var(--accent)' }} />}
                  <span>{calendars.find(c => c.id === formCalendarId)?.name || 'Select'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showCalPicker && (
                  <div className="cal-cal-dropdown">
                    {calendars.map(cal => (
                      <button
                        key={cal.id}
                        className={`cal-cal-option${formCalendarId === cal.id ? ' active' : ''}`}
                        onClick={() => { setFormCalendarId(cal.id); setShowCalPicker(false) }}
                      >
                        <span className="cal-cal-dot-sm" style={{ background: cal.color }} />
                        <span>{cal.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="cal-form-row">
              <label className="cal-form-label">Repeat</label>
              <select
                className="cal-form-select"
                value={formRepeat}
                onChange={e => setFormRepeat(e.target.value as RepeatType)}
              >
                <option value="none">No repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
                <option value="weekdays">Weekdays (Mon–Sat)</option>
              </select>
            </div>
            <textarea
              className="cal-form-input cal-form-textarea"
              placeholder="Details (optional)"
              value={formDetails}
              onChange={e => setFormDetails(e.target.value)}
              rows={3}
            />
            <div className="cal-form-actions">
              <button className="cal-form-btn cal-form-cancel" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="cal-form-btn cal-form-save" onClick={addEvent}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Month picker modal */}
      {showPicker && (
        <div className="modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="modal picker-modal" onClick={e => e.stopPropagation()}>
            <div className="picker-header">
              <button className="cal-nav" onClick={pickerPrevMonth} aria-label="Previous month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="picker-title">{MONTHS[pickerMonth]} {pickerYear}</span>
              <button className="cal-nav" onClick={pickerNextMonth} aria-label="Next month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <div className="picker-weekdays">
              {DAYS.map(d => <span key={d} className="picker-weekday">{d}</span>)}
            </div>
            <div className="picker-grid">
              {pickerCells.map((day, i) => {
                const isTodayDay = day !== null && isSameDay(new Date(pickerYear, pickerMonth, day), today)
                return (
                  <button
                    key={i}
                    className={[
                      'picker-cell',
                      day === null ? 'empty' : '',
                      isTodayDay ? 'today' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={day === null}
                    onClick={() => day !== null && pickDate(day)}
                  >
                    {day ?? ''}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NewCalendarDialog({ onAdd, onClose }: { onAdd: (name: string, color: string) => void, onClose: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CALENDAR_COLORS[0])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 300 }}>
        <h4>New Calendar</h4>
        <input
          className="cal-form-input"
          type="text"
          placeholder="Calendar name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div className="cal-color-picker">
          {CALENDAR_COLORS.map(c => (
            <button
              key={c}
              className={`cal-color-swatch${color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="cal-form-actions">
          <button className="cal-form-btn cal-form-cancel" onClick={onClose}>Cancel</button>
          <button className="cal-form-btn cal-form-save" onClick={() => { if (name.trim()) onAdd(name.trim(), color) }}>Add</button>
        </div>
      </div>
    </div>
  )
}
