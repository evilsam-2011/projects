# Calander

A dark-themed productivity dashboard with a kanban todo board, horizontally scrollable calendar with sub-calendars, pomodoro timer with todo integration, habit tracker (21-day grid), point tracking, command palette, and activity logs. Fully offline-capable PWA.

## Stack

- **Vite** + **React** + **TypeScript**
- **vite-plugin-pwa** for service worker + manifest (fully offline)
- No external UI libraries — all custom CSS
- Data persisted to `localStorage`
- System font stack (no Google Fonts — works offline)

## Project Structure

```
src/
  App.tsx              — root: manages todos, events, calendars, logs state; auto-syncs events→todos; point logging; calendar notifications; theme; auto-pomodoro monitoring
  App.css
  index.css            — global CSS variables, dark/light theme tokens, accent colors, scrollbar
  main.tsx
  notify.ts            — shared browser notification utility with permission request
  sound.ts             — Web Audio API sound effects for pomodoro start/complete
  themes.ts            — theme & accent color definitions, applySettings(), loadSettings()
  components/
    Sidebar.tsx/.css   — expandable nav (60px / 200px), 6 tabs, points display
    TodoPanel.tsx/.css — kanban board with 3 columns, filters, context menu, inline editing, sub-task detail view, drag-reorder
    CalendarPanel.tsx/.css — horizontally scrollable 60-day timeline, sub-calendars, event CRUD, month picker, recurring events, drag-move/resize, pomodoro per-event toggle
    PomodoroPanel.tsx/.css — pomodoro timer (fixed 25/5 min), task linking, auto-mode for calendar events, always-mounted for background ticking
    HabitPanel.tsx/.css — 21-day habit tracker with grid, streak tracking, priority-based points
    LogPanel.tsx/.css  — point transaction history, daily line chart, activity sidebar, delete support
    CommandPalette.tsx/.css — Ctrl+Space quick command palette with icons, tab navigation, theme toggle, sidebar toggle
    SettingsPanel.tsx/.css — theme/accent picker, export/import JSON, clear all data
```

## Sidebar
- Two modes: **collapsed** (60px, icons + points number) / **expanded** (200px, icons + labels)
- Six tabs: **Todo**, **Calendar**, **Pomodoro**, **Habits**, **Logs**, **Settings** with active indicator bar
- **Points counter** at bottom in green — computed from point log total (not directly from todos)

## Todo (Kanban Board)
- 3 columns: **Todo → Doing → Done**
- Add tasks per-column with input, daily toggle, date input, and Add button at bottom of each column
- **Daily task toggle** (refresh icon) — amber badge on task cards; daily tasks always show in all filters
- **Due date input** — set a due date when creating a task; shows badge on card ("3d left", "Due today", "2d overdue")
- Click status dot to cycle: todo → doing → done → todo
- **Drag & drop** to reorder within a column (blue drop indicator line) or move across columns
- Right-click **context menu**: Edit, Move to column, Delete
- **Inline editing** (right-click → Edit → Enter/Blur to save, Escape to cancel)
- **Filter tabs**: Today | This Week | All — filters by creation date; daily tasks always show
- Points: **+10 for starting** (doing), **+30 for finishing** (done) = 40 total per completed task
- **Keyboard shortcut**: `N` to focus add input
- **Toast feedback** on add/update/delete/move
- Empty state when column has no tasks

### Sub-Tasks
- Click any task text to open a **full-panel detail view** (replaces the kanban board)
- Detail view shows task name, status, due date, and a list of sub-tasks with **circular checkboxes**
- Add sub-tasks via input at the bottom
- **Auto-complete**: when all sub-tasks are checked, the main task automatically moves to "Done"
- Click **Back** to return to the kanban board

### Event-Synced Todos
- Each calendar event creates a todo with `event-` prefixed ID
- **Progress bar** on event-synced tasks shows completion percentage
- **Pomodoro badge** (tomato icon + count) on tasks that are linked to the active pomodoro session
- Auto-transitions: todo → doing (at event start) → done (at event end); status checked every 30s

## Calendar (Horizontally Scrollable Timeline)
- **60-day continuous timeline** starting from today — only future days, no past days
- **Horizontal scrolling** through all 60 days with sticky time column on the left
- Day columns are fixed-width (130px min) to enable overflow scrolling
- 24 hourly time slots using `PX_PER_MIN` (0.8 px/min) for accurate event placement
- Navigate with **< > arrows** (jump 14 days) or **Today** button (resets scroll to start)
- **Month picker modal** — click calendar icon to jump to any date
- Hover any empty slot → **+ icon** → click to create event
- **Click any event** to edit name, time, details, pomodoro toggle, calendar assignment, repeat rule, and todo sync
- **Pomodoro toggle** on events: when enabled, the pomodoro timer auto-starts at the event time and runs 25/5 cycles for the full duration
- **Daily events** appear on every day (set via Repeat → "Every day"); events are color-coded by their sub-calendar
- Hover event → **×** to delete
- **Current time indicator** — red line + dot on today's column, updates every 60s
- 24-hour time format throughout
- **Events auto-sync to todos** — each event creates a todo that auto-transitions: todo → doing (at start) → done (at end); status checked every 30s; can be toggled off per event
- **Calendar event notifications** — browser notification 5 minutes before an event starts; each event notified only once per session
- **Due-dated todos** shown as pills in each day column header
- **Drag events** to move (shift time) or drag bottom handle to resize (change duration); snaps to 15-min grid

### Recurring Events
- **Repeat dropdown** on event form: No repeat, Every day, Every week, Every 2 weeks, Every month, Weekdays (Mon–Sat)
- Recurrences are computed dynamically and rendered as event blocks on all matching dates within the 60-day window
- Editing the base event updates all occurrences

### Sub-Calendars
- **Multiple calendars** with unique names and colors (10 swatch colors available)
- Calendar pill bar below topbar — each pill shows a colored dot, name, eye toggle, and delete button
- **Visibility toggle** — hide/show all events of a calendar with one click
- Add new calendars via **+ button** → modal with name input + color picker
- **Delete calendar** (only when more than one exists) removes it entirely
- Events are **color-coded** based on their assigned calendar's color
- Event form has a custom **calendar dropdown selector** with colored dots next to each option
- Old events without a calendarId are auto-migrated to the default calendar on load

## Pomodoro Timer
- **Fixed durations**: Work 25 min → Break 5 min (no configurable presets)
- **SVG ring progress** animated around the timer display, color shifts red → amber → accent as time progresses
- **Start / Pause / Reset** controls
- **Sound effects** via Web Audio API — ascending chime on work complete, descending tone on break complete, quick blip on start
- **Task linking**: dropdown selector shows all Doing + Todo tasks; selected task gets a **pomodoro badge** in the kanban
- **Working-on display** only shows when a non-done linked task exists (hides if task is completed)
- **Auto-advance**: when pomodoro count reaches the target for a linked task, the task moves to "Done"
- **Dynamic target**: for event-linked tasks, target = floor(event duration in minutes / 30); non-event tasks default to 2 sessions
- **Points**: +5 per completed pomodoro session logged automatically
- **Browser notification** when a pomodoro or break completes
- **Runs in background**: the panel stays mounted at all times (hidden via CSS when another tab is active), so the timer keeps ticking across tab switches
- **Page-reload recovery**: saves state every 3s and on explicit actions; uses `savedAt` timestamp to accurately compute elapsed time on reload
- **Auto-pomodoro (calendar integration)**: events with the "Pomodoro" toggle run 25min work + 5min break cycles to fill the event duration (must be a multiple of 30min — e.g., 1h → 25+5+25+5)

## Habits (21-Day Tracker)
- **Make habits** (green, "Build" badge) — mark days you successfully did the habit
- **Break habits** (red, "Quit" badge) — mark days you broke the bad habit
- **21-day grid** (7 cols × 3 rows) showing today through 20 days back
  - Click any cell to mark/unmark it
  - Today's cell has an accent border
  - First row shows weekday abbreviations
- **Progress bar** with X/21 completion count
- **Streak tracking** — consecutive days counting back from today (lightning bolt icon)
- **Priority levels** with points per check-in:
  | Priority | Points |
  |---|---|
  | Low | +5 |
  | Medium | +10 |
  | High | +20 |
- Points awarded only for marking **today** (prevents back-dating abuse)
- **Reset** button clears all dates for a habit
- Data stored in `localStorage` under `calander-habits`

## Logs
- **Point transaction history** — every +10 (started), +30 (completed), +5 (pomodoro), habit points, and reversal is logged with timestamp
- Each entry shows: points, reason, time
- **Daily line chart** showing current month's point totals with Y-axis in 10pt increments
- **Activity sidebar** — summary of current day's point activity
- **Delete** any log entry to permanently remove those points
- Logs are the **source of truth** for the sidebar total; deleting a log immediately reduces the total
- Log total displayed at top
- Empty state when no logs exist

## Command Palette
- **Ctrl+Space** anywhere to open
- Filter commands by typing (searches label + keywords)
- Navigate with **↑↓ arrow keys**, execute with **Enter**, close with **Escape**
- SVG icons next to each command, accent color on selection
- Commands: Go to Todo / Calendar / Pomodoro / Habits / Logs / Settings, Toggle theme (dark/light), Toggle sidebar collapse

## Settings
- **Color Scheme** — Dark / Light theme toggle, 8 accent color swatches (Indigo, Green, Amber, Red, Purple, Blue, Pink, Teal)
- **Data** — Export all data as JSON backup file; Import a backup file to restore
- **Danger Zone** — Double-confirmed Clear All Data button

## Points System
| Action | Points |
|---|---|
| Starting a task (doing) | +10 |
| Completing a task (done) | +30 |
| Total per task | 40 |
| Pomodoro session completed | +5 |
| Habit check-in (low priority) | +5 |
| Habit check-in (medium priority) | +10 |
| Habit check-in (high priority) | +20 |

- Points earned are split into +10 (Started) and +30 (Completed) log entries when a task goes todo→done directly
- **Reversal log entries** are created when points decrease (e.g., done→todo: -40)
- Logs can be deleted to permanently remove points from the total

## Notifications
- **Browser Notification API** — permission requested silently on first user interaction
- **Pomodoro notifications** when a work or break session completes
- **Calendar event reminders** — fires 5 minutes before an event starts; each event ID is tracked to prevent duplicate notifications
- Shared `notify()` utility in `src/notify.ts`

## Design System (`index.css`)

### Color Tokens
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0b0b0f` | Page background |
| `--bg-surface` | `#141417` | Sidebar, card surfaces |
| `--bg-elevated` | `#1c1c22` | Inputs, elevated cards |
| `--bg-hover` | `#24242c` | Hover states |
| `--text` | `#a1a1aa` | Body text |
| `--text-h` | `#f4f4f5` | Headings |
| `--text-dim` | `#6b6b80` | Secondary text |
| `--border` | `#25252d` | Borders |
| `--border-light` | `#2d2d36` | Lighter borders |
| `--accent` | `#6366f1` | Indigo (buttons, active, links) |
| `--accent-bg` | `rgba(99, 102, 241, 0.12)` | Accent hover/active backgrounds |
| `--accent-border` | `rgba(99, 102, 241, 0.3)` | Accent border glow |
| `--green` | `#22c55e` | Done status, points |
| `--green-bg` | `rgba(34, 197, 94, 0.12)` | Green backgrounds |
| `--amber` | `#f59e0b` | Daily event/task color |
| `--amber-bg` | `rgba(245, 158, 11, 0.12)` | Amber backgrounds |
| `--red` | `#ef4444` | Danger, current time indicator |
| `--radius` | `8px` | Standard border radius |
| `--radius-sm` | `6px` | Small border radius |
| `--shadow-lg` | `0 8px 30px rgba(0,0,0,0.4)` | Drop shadows |
| `--transition` | `0.15s ease` | Default transition |

### Layout
- Font: system font stack `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif` (no external font host — works offline)
- Full viewport height layout: `.app` with sidebar + main-area
- Main area adapts to collapsed/expanded sidebar width
- `box-sizing: border-box` is set globally

## Running

```bash
npm run dev      # dev server at localhost:5173
npm run build    # tsc && vite build to dist/
npm run preview  # preview production build (includes service worker)
```

The production build is a fully offline-capable PWA. Open `dist/` with any static server or `npm run preview` to test the service worker and offline functionality.

## Development Notes
- Calendar panel height uses `height: 100vh` with `box-sizing: border-box` to account for padding
- Scroll container uses `overflow: auto` with `min-height: 0` to enable both vertical and horizontal scrolling
- Day columns use `flex: 1 0 130px` for a minimum width that enables horizontal overflow
- Event-synced todos use `event-` prefix in their ID to distinguish from manual todos
- The `getEventsForDate` function filters by both date match, calendar visibility, and recurrence rules
- Pomodoro dynamic target: `getDynamicTarget()` computes sessions as `Math.floor(eventDurationMinutes / 30)`
- Streak computation in HabitPanel counts consecutive days backward from today using a Set lookup
- Notifications track `notifiedEventIds` in App.tsx to avoid duplicate calendar alerts
- Theme/accent applied via `data-theme` and `data-accent` attributes on `<html>`
- Todo order field is used for within-column drag-reorder; normalized on drop
- Calendar event drag uses refs (not state) for smooth mousemove tracking, with 15-min snap
- Times are displayed in 12-hour format with AM/PM; `format12()` converts "HH:MM" to "h:MM", `ampmLabel()` returns "AM"/"PM"
- Time column is 66px wide with `white-space: nowrap` to prevent AM/PM wrapping on wider times like "12:00 PM"
- PomodoroPanel is always mounted in App.tsx (wrapped in `<div className={activeTab === 'pomodoro' ? '' : 'panel-hidden'}>`) so the timer interval keeps running across tab switches
- `autoModeRef` tracks remaining 25/5 cycles for calendar-linked pomodoro events; cleared on pause/reset
- `savedAt` timestamp is saved alongside pomodoro state and used in `loadState()` to compute elapsed time since last save (avoids double-counting time when recovering a running timer on page reload)
- State is saved to localStorage every 3s (periodic interval) and immediately on start/pause/reset — NOT on every render tick, to avoid synchronous I/O blocking
- Pomodoro auto-mode transitions use `setTimeout(0, 50)` to break React 18's automatic batching, ensuring `running: false` triggers the effect cleanup before `running: true` restarts it with new mode/duration
- Sound effects use Web Audio API (no audio files) — `AudioContext` created lazily on first use, tones generated with `OscillatorNode` + `GainNode`
- Command palette uses a global `keydown` listener for Ctrl+Space; `selectedIdx` + `scrollIntoView` for keyboard navigation; filtered command list rebuilt on each keystroke
- PWA service worker generated by `vite-plugin-pwa` with `generateSW` strategy, precaches all build assets (`globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']`)
- No external font loading — system font stack removes the Google Fonts network dependency, enabling full offline use
- `index.html` no longer links to `fonts.googleapis.com`; `--sans` CSS variable uses system fonts only
