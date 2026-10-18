import { useState, useRef, useEffect, type KeyboardEvent, type MouseEvent, type Dispatch, type SetStateAction } from 'react'
import React from 'react'
import './TodoPanel.css'
import type { CalendarEvent } from './CalendarPanel'

export type Status = 'todo' | 'doing' | 'done'

export interface Subtask {
  id: string
  text: string
  done: boolean
}

export interface Todo {
  id: string
  text: string
  status: Status
  daily: boolean
  points: number
  created: string
  subtasks: Subtask[]
  pomodoros: number
  pomoTarget: number
  dueDate?: string
  order: number
}

export const POINTS_DOING = 10
export const POINTS_DONE = 30
export const POINTS_POMO = 5
export const STORAGE_KEY = 'calander-todos'

export function getPointsForStatus(status: Status): number {
  if (status === 'doing') return POINTS_DOING
  if (status === 'done') return POINTS_DOING + POINTS_DONE
  return 0
}
const COLUMNS: { key: Status; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
]

interface ContextMenu {
  x: number
  y: number
  todoId: string
}

interface TodoPanelProps {
  todos: Todo[]
  setTodos: Dispatch<SetStateAction<Todo[]>>
  events: CalendarEvent[]
}

export default function TodoPanel({ todos, setTodos, events }: TodoPanelProps) {
  const [inputs, setInputs] = useState<Record<Status, string>>({ todo: '', doing: '', done: '' })
  const [dailys, setDailys] = useState<Record<Status, boolean>>({ todo: false, doing: false, done: false })
  const [formDueDates, setFormDueDates] = useState<Record<string, string>>({})
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null)
  const [dropIndex, setDropIndex] = useState<{ col: Status; idx: number } | null>(null)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<'today' | 'week' | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [subtaskTexts, setSubtaskTexts] = useState<Record<string, string>>({})
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(id)
  }, [toast])
  const editRef = useRef<HTMLInputElement>(null)

  function todayStr() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function isInCurrentWeek(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00')
    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    return date >= weekStart && date <= weekEnd
  }

  function filterTodo(t: Todo): boolean {
    if (filter === 'all') return true
    if (t.daily) return true
    const created = t.created || todayStr()
    if (filter === 'today') return created === todayStr()
    if (filter === 'week') return isInCurrentWeek(created)
    return true
  }
  const inputRefs = useRef<Record<Status, HTMLInputElement | null>>({ todo: null, doing: null, done: null })
  const dragId = useRef<string | null>(null)

  useEffect(() => {
    function handleClick(e: PointerEvent) {
      if (e.button !== 0) return
      setContextMenu(null)
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setContextMenu(null)
        setEditingId(null)
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        const firstInput = Object.values(inputRefs.current).find(Boolean)
        firstInput?.focus()
      }
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus()
      editRef.current.select()
    }
  }, [editingId])

  function addTodo(status: Status) {
    const text = inputs[status].trim()
    if (!text) return
    const colTodos = todos.filter(t => t.status === status)
    const maxOrder = colTodos.length > 0 ? Math.max(...colTodos.map(t => t.order)) : 0
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      status,
      daily: dailys[status],
      points: getPointsForStatus(status),
      created: todayStr(),
      subtasks: [],
      pomodoros: 0,
      pomoTarget: 2,
      dueDate: formDueDates[status] || undefined,
      order: maxOrder + 1,
    }
    setTodos(prev => [...prev, todo])
    setInputs(prev => ({ ...prev, [status]: '' }))
    setDailys(prev => ({ ...prev, [status]: false }))
    setFormDueDates(prev => ({ ...prev, [status]: '' }))
    inputRefs.current[status]?.focus()
    setToast('Task added')
  }

  function handleKeyDown(e: KeyboardEvent, status: Status) {
    if (e.key === 'Enter') addTodo(status)
  }

  function cycleStatus(id: string) {
    setAnimatingIds(prev => new Set(prev).add(id))
    setTodos(prev =>
      prev.map(t => {
        if (t.id !== id) return t
        const order: Status[] = ['todo', 'doing', 'done']
        const idx = order.indexOf(t.status)
        const nextStatus = order[(idx + 1) % order.length]
        return {
          ...t,
          status: nextStatus,
          points: getPointsForStatus(nextStatus),
        }
      })
    )
    setTimeout(() => {
      setAnimatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 400)
  }

  function setStatus(id: string, status: Status) {
    setTodos(prev =>
      prev.map(t => {
        if (t.id !== id) return t
        return {
          ...t,
          status,
          points: getPointsForStatus(status),
        }
      })
    )
    setContextMenu(null)
    setToast(`Moved to ${status}`)
  }

  function removeTodo(id: string) {
    setAnimatingIds(prev => new Set(prev).add(id))
    setTimeout(() => {
      setTodos(prev => prev.filter(t => t.id !== id))
      setAnimatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 250)
    setToast('Task deleted')
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function addSubtask(id: string) {
    const text = (subtaskTexts[id] || '').trim()
    if (!text) return
    setTodos(prev => prev.map(t => t.id === id ? { ...t, subtasks: [...t.subtasks, { id: crypto.randomUUID(), text, done: false }] } : t))
    setSubtaskTexts(prev => ({ ...prev, [id]: '' }))
  }

  function toggleSubtask(todoId: string, subtaskId: string) {
    setTodos(prev => prev.map(t => {
      if (t.id !== todoId) return t
      const subtasks = t.subtasks.map(st => st.id === subtaskId ? { ...st, done: !st.done } : st)
      const allDone = subtasks.length > 0 && subtasks.every(st => st.done)
      return {
        ...t,
        subtasks,
        status: allDone && t.status !== 'done' ? 'done' : t.status,
        points: allDone && t.status !== 'done' ? getPointsForStatus('done') : t.points,
      }
    }))
  }

  function getEventProgress(todo: Todo): number | null {
    if (!todo.id.startsWith('event-')) return null
    if (todo.status === 'done') return 100
    if (todo.status === 'todo') return 0
    const eventId = todo.id.slice(6)
    const event = events.find(e => e.id === eventId)
    if (!event) return null
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const targetDate = event.daily ? dateStr : event.date
    const start = new Date(`${targetDate}T${event.start}`).getTime()
    const end = new Date(`${targetDate}T${event.end}`).getTime()
    const total = end - start
    if (total <= 0) return null
    const elapsed = now - start
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }

  function handleContextMenu(e: MouseEvent, id: string) {
    e.preventDefault()
    const menuWidth = 150
    const menuHeight = 160
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), todoId: id })
  }

  function startEdit(id: string, text: string) {
    setEditingId(id)
    setEditText(text)
    setContextMenu(null)
  }

  function saveEdit(id: string) {
    const trimmed = editText.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }
    setTodos(prev =>
      prev.map(t => (t.id === id ? { ...t, text: trimmed } : t))
    )
    setEditingId(null)
    setToast('Task updated')
  }

  function handleEditKeyDown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter') saveEdit(id)
    if (e.key === 'Escape') setEditingId(null)
  }

  function handleDragStart(id: string) {
    dragId.current = id
  }

  function handleDragOver(e: React.DragEvent, status: Status) {
    e.preventDefault()
    setDragOverCol(status)
    const items = [...(e.currentTarget as HTMLElement).querySelectorAll('.kanban-item')]
    const mouseY = e.clientY
    let idx = items.length
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      if (mouseY < rect.top + rect.height / 2) { idx = i; break }
    }
    setDropIndex({ col: status, idx })
  }

  function handleDragLeave(status: Status) {
    setDragOverCol(prev => prev === status ? null : prev)
    setDropIndex(null)
  }

  function handleDrop(e: React.DragEvent, status: Status) {
    e.preventDefault()
    setDragOverCol(null)
    const id = dragId.current
    dragId.current = null
    if (!id) return
    setDropIndex(null)

    const insertIdx = dropIndex?.col === status ? dropIndex.idx : null

    setTodos(prev => {
      const dragged = prev.find(t => t.id === id)
      if (!dragged) return prev
      const sameCol = dragged.status === status
      const colTodos = prev.filter(t => t.status === status && t.id !== id).sort((a, b) => a.order - b.order)
      const insertAt = insertIdx !== null ? insertIdx : colTodos.length

      let reordered = prev.map(t => {
        if (t.id === id) return { ...t, status, order: 0 }
        let o = t.order
        if (t.status === status) {
          const idx = colTodos.indexOf(t)
          o = idx < insertAt ? idx * 2 : (idx + 1) * 2
        }
        if (t.status === dragged.status && sameCol && t.order > dragged.order) o = t.order - 1
        return { ...t, order: o }
      })

      const grouped: Record<Status, Todo[]> = { todo: [], doing: [], done: [] }
      for (const t of reordered) grouped[t.status].push(t)
      const normalized: Todo[] = []
      for (const col of ['todo', 'doing', 'done'] as Status[]) {
        grouped[col].sort((a, b) => a.order - b.order)
        grouped[col].forEach((t, i) => normalized.push({ ...t, order: i * 2 }))
      }
      return normalized
    })

    const dragged = todos.find(t => t.id === id)
    if (dragged && dragged.status !== status) setToast(`Moved to ${status}`)
  }

  const todo = contextMenu ? todos.find(t => t.id === contextMenu.todoId) : null
  const statusOrder: Status[] = ['todo', 'doing', 'done']
  const menuItems = todo
    ? [
        { label: 'Edit', action: () => startEdit(todo.id, todo.text) },
        ...statusOrder.filter(s => s !== todo.status).map(s => ({
          label: `Move to ${s.charAt(0).toUpperCase() + s.slice(1)}`,
          action: () => setStatus(todo.id, s),
        })),
        { label: 'Delete', action: () => removeTodo(todo.id) },
      ]
    : []

  return (
    <>
      {expandedId ? (() => {
        const task = todos.find(t => t.id === expandedId)
        if (!task) return null
        return (
          <div className="kanban-detail">
            <div className="kanban-detail-header">
              <button className="kanban-detail-back" onClick={() => setExpandedId(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <h2 className="kanban-detail-title">{task.text}</h2>
              {task.daily && (
                <span className="todo-daily-badge" title="Repeats daily">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </span>
              )}
              {task.dueDate && (
                <span className={`todo-due-badge ${new Date(task.dueDate + 'T23:59:59') < new Date() ? 'overdue' : ''}`}>
                  Due: {task.dueDate}
                </span>
              )}
            </div>
            <div className="kanban-detail-subtasks">
              {task.subtasks.map(st => (
                <label key={st.id} className="kanban-detail-row">
                  <input
                    type="checkbox"
                    className="kanban-detail-check"
                    checked={st.done}
                    onChange={() => toggleSubtask(expandedId, st.id)}
                  />
                  <span className={`kanban-detail-text${st.done ? ' done' : ''}`}>{st.text}</span>
                </label>
              ))}
            </div>
            <div className="kanban-detail-add">
              <input
                className="kanban-detail-input"
                type="text"
                placeholder="Add sub-task..."
                value={subtaskTexts[expandedId] || ''}
                onChange={e => setSubtaskTexts(prev => ({ ...prev, [expandedId]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addSubtask(expandedId); if (e.key === 'Escape') setExpandedId(null) }}
                autoFocus
              />
              <button className="kanban-detail-btn" onClick={() => addSubtask(expandedId)}>+</button>
            </div>
            {task.subtasks.length > 0 && (
              <div className="kanban-detail-progress">
                {task.subtasks.filter(st => st.done).length} / {task.subtasks.length}
              </div>
            )}
          </div>
        )
      })() : (
        <>
      <div className="kanban-header">
        <div className="kanban-header-left">
          <h2>Tasks</h2>
          <div className="kanban-filters">
            <button
              className={`kanban-filter-btn ${filter === 'today' ? 'active' : ''}`}
              onClick={() => setFilter('today')}
            >Today</button>
            <button
              className={`kanban-filter-btn ${filter === 'week' ? 'active' : ''}`}
              onClick={() => setFilter('week')}
            >This Week</button>
            <button
              className={`kanban-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >All</button>
          </div>
        </div>
        <div className="kanban-header-right">
          <span className="todo-stats">
            {todos.filter(t => t.status === 'done' && filterTodo(t)).length}/{todos.filter(filterTodo).length} done
          </span>
          <span className="todo-shortcuts" title="Keyboard shortcuts">
            <kbd>N</kbd> new
          </span>
        </div>
      </div>

      <div className="kanban-board">
        {COLUMNS.map(col => {
            const colTodos = todos.filter(t => t.status === col.key && filterTodo(t)).sort((a, b) => a.order - b.order)
          return (
            <div key={col.key} className="kanban-col">
              <div className="kanban-col-header">
                <span className="kanban-col-title">{col.label}</span>
                <span className="kanban-col-count">{colTodos.length}</span>
              </div>

              <div
                className={['kanban-col-list', dragOverCol === col.key ? 'drag-over' : ''].filter(Boolean).join(' ')}
                onDragOver={e => handleDragOver(e, col.key)}
                onDragLeave={() => handleDragLeave(col.key)}
                onDrop={e => handleDrop(e, col.key)}
              >
                {colTodos.length === 0 && !dropIndex && (
                  <div className="kanban-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    No tasks
                  </div>
                )}
                {colTodos.map((todo, i) => (
                  <React.Fragment key={todo.id}>
                    {dropIndex?.col === col.key && dropIndex.idx === i && (
                      <div className="drop-indicator" />
                    )}
                    <div
                      className={[
                        'kanban-item',
                        animatingIds.has(todo.id) ? 'completing' : '',
                      ].filter(Boolean).join(' ')}
                      draggable="true"
                      onDragStart={() => handleDragStart(todo.id)}
                      onContextMenu={e => handleContextMenu(e, todo.id)}
                    >
                    <button
                      className={`status-dot ${todo.status}`}
                      onClick={() => cycleStatus(todo.id)}
                      aria-label={`Status: ${todo.status}`}
                    >
                      {todo.status === 'done' && (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {todo.status === 'doing' && (
                        <span className="doing-dot" />
                      )}
                    </button>

                    {editingId === todo.id ? (
                      <input
                        ref={editRef}
                        className="todo-edit-input"
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => saveEdit(todo.id)}
                        onKeyDown={e => handleEditKeyDown(e, todo.id)}
                      />
                    ) : (
                      <span
                        className={`kanban-item-text ${todo.status === 'done' ? 'done' : ''}`}
                        onClick={() => toggleExpand(todo.id)}
                      >
                        {todo.text}
                      </span>
                    )}

                    {todo.daily && (
                      <span className="todo-daily-badge" title="Repeats daily">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </span>
                    )}

                    {todo.dueDate && (() => {
                      const due = new Date(todo.dueDate + 'T23:59:59')
                      const today = new Date()
                      today.setHours(0,0,0,0)
                      const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000)
                      const overdue = diffDays < 0
                      const dueClass = overdue ? 'overdue' : diffDays === 0 ? 'due-today' : ''
                      return (
                        <span className={`todo-due-badge ${dueClass}`} title={`Due: ${todo.dueDate}`}>
                          {overdue ? `${Math.abs(diffDays)}d overdue` : diffDays === 0 ? 'Due today' : `${diffDays}d left`}
                        </span>
                      )
                    })()}

                    {todo.pomodoros > 0 && (
                      <span className="todo-pomo-badge" title="Pomodoros completed">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {todo.pomodoros}/{todo.pomoTarget}
                      </span>
                    )}

                    <button
                      className="todo-delete"
                      onClick={() => removeTodo(todo.id)}
                      aria-label="Delete task"
                    >
                      ×
                    </button>

                    {todo.subtasks.length > 0 && (
                      <div className="todo-subtasks-expand-indicator">
                        <span>{todo.subtasks.filter(st => st.done).length}/{todo.subtasks.length}</span>
                      </div>
                    )}
                    {(() => {
                      const pct = getEventProgress(todo)
                      if (pct === null || pct <= 0 || pct >= 100) return null
                      return (
                        <div className="todo-event-progress">
                          <div className="todo-event-progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                      )
                    })()}
                  </div>
                  </React.Fragment>
                ))}
                {dropIndex?.col === col.key && dropIndex.idx === colTodos.length && (
                  <div className="drop-indicator" />
                )}
              </div>

              <div className="kanban-add">
                <input
                  ref={el => { inputRefs.current[col.key] = el }}
                  className="kanban-add-input"
                  type="text"
                  placeholder={`Add to ${col.label}...`}
                  value={inputs[col.key]}
                  onChange={e => setInputs(prev => ({ ...prev, [col.key]: e.target.value }))}
                  onKeyDown={e => handleKeyDown(e, col.key)}
                />
                <div className="kanban-add-row">
                  {formDueDates[col.key] && (
                    <span className="kanban-due-preview">{formDueDates[col.key]}</span>
                  )}
                  <input
                    className="kanban-date-input"
                    type="date"
                    value={formDueDates[col.key] || ''}
                    onChange={e => setFormDueDates(prev => ({ ...prev, [col.key]: e.target.value }))}
                    title="Due date"
                  />
                  <button
                    className={`daily-toggle-sm ${dailys[col.key] ? 'active' : ''}`}
                    onClick={() => setDailys(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                    title="Repeats daily"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                  <button className="kanban-add-btn" onClick={() => addTodo(col.key)}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      </>)}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {menuItems.map(item => (
            <button key={item.label} className="context-menu-item" onClick={item.action}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {toast && <div className="todo-toast">{toast}</div>}
    </>
  )
}
