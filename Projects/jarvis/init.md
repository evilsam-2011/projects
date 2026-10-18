# Spectre — Virtual Company HQ (You're the CEO)

## Setup

```fish
cd ~/Projects/jarvis
source venv/bin/activate.fish  # fish shell
# or: source venv/bin/activate  # bash/zsh
python main.py
# Open http://localhost:8000
```

## Project Structure

```
jarvis/
├── main.py              # FastAPI backend + Groq API + Mistral API + SQLite
├── requirements.txt     # fastapi, uvicorn, groq, jinja2, python-dotenv, httpx, google-api-python-client
├── .env                 # GROQ_API_KEY + MISTRAL_API_KEY + OPEN_ROUTER_API_KEY + GOOGLE_CLIENT_*
├── .gitignore           # Excludes venv/, *.db, .env, __pycache__/
├── init.md              # This file
├── soul.md              # CEO company mission / system prompt
├── memory.md            # Shared long-term memory for the AI
├── personalities/       # Per-employee personality files (harry.md, penny.md, david.md)
├── memories/            # Per-employee long-term memory files (harry.md, penny.md, david.md)
├── jarvis.db            # SQLite DB (auto-created at startup)
├── google_service.py    # Google OAuth2, Calendar & Gmail API wrapper
├── ssl/                 # Self-signed certs for HTTPS (optional)
├── venv/                # Python 3.14 virtual env
├── templates/
│   └── index.html       # Dashboard with Office + Chat + Settings + Todos tabs
├── static/
│   ├── css/
│   │   └── style.css    # Dark theme, office building, Pac-Man ghosts
│   └── js/
│       └── chat.js      # SpectreApp + OfficeController + Todo UI
├── run-https.sh         # Starts with HTTPS + QR code (optional)
```

## What's Built

### 🏢 Virtual Company HQ
- **Office tab** — building cross-section with 5 floors:
  - **Penthouse** — CEO office (you)
  - **Floor 2 — Management** — Harry the ghost manager (Pac-Man, pink, left) + Penny the personal assistant (Pac-Man, teal, right)
  - **Floor 1 — Engineering** — David the coder (OpenRouter, purple `#845ef7`)
  - **Ground Floor — Team** — Employee grid with mini cards
- **Harry** (Pac-Man ghost, pink `#ff69b4`) — auto-created on startup, animated patrol across the room, click to speed boost
- **Penny** (Pac-Man ghost, teal `#20c997`) — auto-created on startup, independent patrol animation, click to speed boost
- **David** (human avatar, purple `#845ef7`) — auto-created on startup, Engineering floor, uses OpenRouter
- **Employee management** — hire/fire AI employees (name, role, model)
- **🧠 Per-employee memory** — click the 🧠 button on any employee card to view/edit their personal memory file
- **📝 Per-employee personality** — click the 📝 button to edit each employee's identity, role, and personality markdown file
- Each employee loads their personality from `personalities/{name}.md` and memory from `memories/{name}.md` — easy to edit outside the UI

### 👻 Ghost Animations
- **Harry** — 10s patrol cycle (−100px ↔ +100px) with 3s body bob, pink glow
- **Penny** — 12s patrol cycle (+80px ↔ −80px) with 3.5s body bob, teal glow
- Both ghosts have: blinking eyes, looking-around pupils, floating wave bottom
- Click either ghost for a 3× speed burst animation

### 💬 Chat
- Full chat interface with markdown rendering
- Chat with Harry through the **💬 Chat** tab (routes through Groq API)
- Chat with Penny through the **💬 Chat** tab (routes through Mistral API)
- Chat with David through the **💬 Chat** tab (routes through OpenRouter API)
- **Group Chat** (💬 button) — talk to everyone at once:
  - Messages without `@mention` go to **Harry** (the manager) by default
  - Use `@harry`, `@penny`, or `@david` to ping a specific employee
  - Harry can **delegate** tasks: "generate snake game code" → delegates to David, "add todo" → delegates to Penny
  - Delegations use `[DELEGATE: employee="Name" task="..."]` tags in Harry's responses
  - Each employee's response shows with their avatar and name badge
  - Delegation chains are visible: "Harry → David: Write snake game" with David's response below
- Conversation history with auto-save, load/delete from sidebar
- Token usage display
- Employee selector to switch between Harry (👻), Penny (🤖), David (💜), and Group (💬)

### 📋 To-Do List
- **Todos tab** — full CRUD todo list with filter buttons (All / Active / Completed)
- Add tasks via the input box or through chat with Penny
- **Chat-based todo management**:
  - Penny's system prompt includes `[ACTION: add_todo text="..."]`, `[ACTION: complete_todo id=1]`, `[ACTION: list_todos]`, and `[ACTION: delete_todo id=1]` tags
  - She can add, complete, list, and delete todos through natural conversation
  - A `_handle_todo_intents` function intercepts user messages like "add X to my todo" before they reach the LLM, executing the operation directly against the database
  - If the intent handler doesn't match, Penny can generate `[ACTION: ...]` tags in her reply, which are processed server-side
- The frontend automatically refreshes the todo list after any chat response

### 🔗 Google Services
- **Settings > Google Services** — Connect your Google account via OAuth2
- Supports **Google Calendar**:
  - List upcoming events
  - Create new events (with attendees, location, description)
- Supports **Gmail**:
  - List inbox messages
  - Read full email content
  - Send emails (with CC support)
- **Penny can manage your calendar and email** through `[ACTION: ...]` tags in conversation:
  - `[ACTION: list_calendar_events max_results=10]`
  - `[ACTION: create_calendar_event summary="..." start_time="..." end_time="..."]`
  - `[ACTION: list_gmail_inbox max_results=5]`
  - `[ACTION: send_gmail to="..." subject="..." body="..."]`
- OAuth2 tokens are stored in SQLite and auto-refreshed when expired
- Google credentials stored in `google_service.py` with a dedicated DB table

### 🧠 Per-Employee Personality & Memory System
- Each employee has their **own personality file** (`personalities/{name}.md`) and **memory file** (`memories/{name}.md`)
- **Personality** defines who they are: name, role, company info, CEO, personality traits, communication style
- **Memory** stores what they remember long-term: projects, tasks, important facts
- Both are loaded into the AI context on every chat (personality as the system prompt, memory as context)
- Edit via the 📝 (personality) or 🧠 (memory) buttons in the Team Members list
- Files are seeded automatically on first startup for Harry, Penny, and David
- Also sync'd to DB for backward compatibility

### ⚙️ Settings
- System prompt (soul.md) editor
- Shared memory (memory.md) editor
- Temperature slider
- Groq API key input
- Google Services connection panel (Connect / Disconnect)

**Note:** Free OpenRouter models (`nvidia/nemotron-3-super-120b-a12b:free`) may be unavailable without credits. See [openrouter.ai/docs/credits](https://openrouter.ai/docs/credits).

### Backend API

| Endpoint | Description |
|---|---|
| `GET /` | Dashboard UI |
| `GET /api/status` | Server status check |
| `GET /api/models` | Available Groq + Mistral models |
| `POST /api/chat` | General chat (with shared memory context) |
| **Employees** | |
| `GET /api/company/employees` | List all employees (includes memory) |
| `POST /api/company/employees` | Hire an employee |
| `DELETE /api/company/employees/{id}` | Fire an employee |
| `POST /api/company/chat/{id}` | Chat with an employee (routes to Groq, Mistral, or OpenRouter) |
| `POST /api/company/group-chat` | Group chat — routes to Harry by default, @mentions override, delegates via `[DELEGATE:...]` tags |
| **Per-Employee Memory & Personality** | |
| `GET /api/company/employees/{id}/memory` | Get employee's personal memory (file + DB fallback) |
| `PUT /api/company/employees/{id}/memory` | Update employee's personal memory (file + DB) |
| `POST /api/company/employees/{id}/memory/append` | Append to employee's personal memory (file + DB) |
| `GET /api/company/employees/{id}/personality` | Get employee's personality (file + DB fallback) |
| `PUT /api/company/employees/{id}/personality` | Update employee's personality (file + DB) |
| **Conversations** | |
| `GET /api/conversations` | List all conversations |
| `POST /api/conversations` | Create a conversation |
| `GET /api/conversations/{id}` | Get conversation with messages |
| `PUT /api/conversations/messages` | Save messages to a conversation |
| `DELETE /api/conversations/{id}` | Delete a conversation |
| **Settings** | |
| `GET /api/settings/system-prompt` | Get soul.md |
| `PUT /api/settings/system-prompt` | Update soul.md |
| `GET /api/memory` | Get shared memory.md |
| `PUT /api/memory` | Update shared memory.md |
| `POST /api/memory/append` | Append to shared memory.md |
| **To-Do List** | |
| `GET /api/todos?filter=` | List todos (filter: `active`, `completed`, or empty for all) |
| `POST /api/todos` | Add a new todo |
| `PUT /api/todos/{id}/toggle` | Toggle todo completed status |
| `PUT /api/todos/{id}` | Update todo text |
| `DELETE /api/todos/{id}` | Delete a todo |
| **Google Services** | |
| `GET /api/google/auth-url` | Get Google OAuth2 authorization URL |
| `GET /auth/google/callback` | OAuth2 callback handler |
| `GET /api/google/status` | Check Google connection status |
| `POST /api/google/disconnect` | Disconnect Google account |
| `GET /api/google/calendar/events` | List upcoming calendar events |
| `POST /api/google/calendar/events` | Create a calendar event |
| `GET /api/google/gmail/inbox` | List recent emails |
| `POST /api/google/gmail/send` | Send an email |
| `GET /api/google/gmail/message/{id}` | Get full email content |

### AI Models

Pre-loaded employees use different APIs:

| Employee | Model | API | Role |
|---|---|---|---|---|
| 👻 Harry | `llama-3.3-70b-versatile` | Groq | Manager & Head of Operations |
| 🤖 Penny | `mistral-large-latest` | Mistral | Personal Assistant (P.A.) |
| 💜 David | `nvidia/nemotron-3-super-120b-a12b:free` | OpenRouter | Senior Software Engineer |

## Quick Start

```bash
cd ~/Projects/jarvis
# Set your API keys in .env
# GROQ_API_KEY=gsk_...
# MISTRAL_API_KEY=your_mistral_key
# OPEN_ROUTER_API_KEY=your_open_router_key
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

source venv/bin/activate
python main.py
# → http://localhost:8000
```

Then click **🏢 Office** to see:
- 👑 CEO penthouse (you)
- 👻 Harry the ghost manager patrolling Floor 2 (left)
- 🤖 Penny the assistant patrolling Floor 2 (right)
- 💜 David the coder on Floor 1
- 👥 Team members on Ground Floor

Click **💬 Chat** to talk to Harry, Penny, or David. Try saying "add buy groceries to my todo" to Penny!

Click **⚙️ Settings** → **Google Services** to connect your Google Calendar & Gmail.

## Git History

| Commit | Description |
|---|---|
| `(HEAD)` | Group chat: `POST /api/company/group-chat`, @mentions, Harry delegation via `[DELEGATE:...]`, sender badges in UI |
| | Per-employee personality & memory file system: `personalities/*.md`, `memories/*.md`, 📝 editor in UI |
| | Add David (Coder, OpenRouter, GPT-OSS 120B), own Engineering floor; update init.md |
| | Fix: Add missing `conn.commit()` in `_handle_todo_intents` so todos added via chat persist to DB |
| | Google OAuth2 + Calendar & Gmail API integration via `google_service.py` |
| | To-do list system — CRUD endpoints, chat-based todo management, intent handler, Penny action tags |
| | Add Penny Pac-Man ghost, per-employee memory system, Harry patrol animation |
| | Spectre rebrand — Multi-API support, Penny P.A., conversations |
| | Add voice mode with HTTPS, QR code, and audio visualizer |
| | Add interrupt, continuous voice loop, and stop commands |
