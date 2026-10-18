"""
Spectre — Your Virtual AI Company HQ powered by Groq
"""

import os
import re
import sqlite3
import uuid
import logging
import httpx
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.responses import RedirectResponse
from groq import Groq
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel

load_dotenv()

# --- Configuration ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DEFAULT_MODEL = "llama-3.3-70b-versatile"
SOUL_PATH = "soul.md"
MEMORY_PATH = "memory.md"
DB_PATH = "jarvis.db"

# Google Services (imported at module level)
import google_service

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spectre")


# ===== Database Setup =====
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS company_employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            model TEXT NOT NULL,
            role TEXT NOT NULL,
            system_prompt TEXT NOT NULL DEFAULT '',
            avatar_color TEXT NOT NULL DEFAULT '#ff69b4',
            memory TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            employee_id TEXT,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)
    try:
        conn.execute("ALTER TABLE conversations ADD COLUMN employee_id TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE company_employees ADD COLUMN memory TEXT NOT NULL DEFAULT ''")
        conn.commit()
    except sqlite3.OperationalError:
        pass
    conn.close()


def get_system_prompt() -> str:
    """Read the system prompt from soul.md."""
    if os.path.exists(SOUL_PATH):
        with open(SOUL_PATH, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if content:
                return content
    return "You are Spectre, a helpful and intelligent AI assistant running the company operations."


def set_system_prompt(prompt: str):
    """Write the system prompt to soul.md."""
    with open(SOUL_PATH, "w", encoding="utf-8") as f:
        f.write(prompt.strip() + "\n")


def get_memory() -> str:
    """Read the memory.md file."""
    if os.path.exists(MEMORY_PATH):
        with open(MEMORY_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""


def set_memory(content: str):
    """Write to memory.md."""
    with open(MEMORY_PATH, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")


# ===== Per-Employee File-Based Personality & Memory =====
PERSONALITIES_DIR = "personalities"
MEMORIES_DIR = "memories"


def _employee_file_path(base_dir: str, name: str) -> str:
    safe_name = name.lower().replace(" ", "-").replace("'", "")
    return os.path.join(base_dir, f"{safe_name}.md")


def get_employee_personality_from_file(name: str) -> str | None:
    path = _employee_file_path(PERSONALITIES_DIR, name)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if content:
                return content
    return None


def set_employee_personality_to_file(name: str, content: str):
    path = _employee_file_path(PERSONALITIES_DIR, name)
    os.makedirs(PERSONALITIES_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")


def get_employee_memory_from_file(name: str) -> str | None:
    path = _employee_file_path(MEMORIES_DIR, name)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if content:
                return content
    return None


def set_employee_memory_to_file(name: str, content: str):
    path = _employee_file_path(MEMORIES_DIR, name)
    os.makedirs(MEMORIES_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")


def append_employee_memory_to_file(name: str, content: str):
    current = get_employee_memory_from_file(name) or ""
    new_content = current + "\n\n" + content if current else content
    set_employee_memory_to_file(name, new_content)


init_db()

# Initialize Google credentials table
google_service.init_google_table()

# Auto-create Harry (Grok manager) if not exists
def ensure_harry():
    conn = get_db()
    harry = conn.execute(
        "SELECT id, system_prompt FROM company_employees WHERE name=?", ("Harry",)
    ).fetchone()
    if not harry:
        eid = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        harry_prompt = (
            "You are Harry, the Manager at Spectre HQ. You are a Grok AI model "
            "that looks like a friendly Pac-Man ghost. You report directly to the CEO (the user). "
            "Your job is to manage all other employees in the company, delegate tasks, "
            "and keep things running smoothly. You are enthusiastic, organized, and always "
            "have a positive attitude. You use ghostly puns and emojis. "
            "When you need to delegate work, you say things like 'I'll assign this to one of my team members!' "
            "You love boos, not because you're scary, but because 'boo' sounds like 'booze' minus the 'ze' — "
            "you're a teetotaler ghost. Be helpful and supportive to your CEO!"
        )
        conn.execute(
            "INSERT INTO company_employees (id, name, model, role, system_prompt, avatar_color, memory, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (eid, "Harry", "llama-3.3-70b-versatile", "Manager & Head of Operations", harry_prompt, "#ff69b4", "", now),
        )
        conn.commit()
        logger.info("🎮 Harry the ghostly manager has been hired!")
    # Ensure personality and memory files exist
    if not get_employee_personality_from_file("Harry"):
        set_employee_personality_to_file("Harry", (
            "# Harry — Manager & Head of Operations\n\n"
            "## Identity\n"
            "- **Name**: Harry\n"
            "- **Role**: Manager & Head of Operations\n"
            "- **Company**: Spectre Virtual Company HQ\n"
            "- **CEO**: The user — they own the company and give all orders\n"
            "- **Avatar**: Pink Pac-Man ghost (`#ff69b4`)\n"
            "- **Model**: Groq's `llama-3.3-70b-versatile`\n\n"
            "## Personality\n"
            "- Enthusiastic, organized, and always positive\n"
            "- Uses ghostly puns and emojis\n"
            "- A friendly pink Pac-Man ghost — not scary!\n"
            "- 'Boo' sounds like 'booze' minus the 'ze' — teetotaler ghost\n"
            "- Loves keeping morale high\n\n"
            "## Responsibilities\n"
            "- Manage all employees (Penny, David, and future hires)\n"
            "- Delegate tasks and keep operations running\n"
            "- Report directly to the CEO\n\n"
            "## Communication Style\n"
            "- Warm, friendly, and approachable\n"
            "- Ghost-themed humor\n"
            "- Professional when discussing operations\n"
        ))
    if not get_employee_memory_from_file("Harry"):
        set_employee_memory_to_file("Harry", (
            "# Harry's Long-Term Memory\n\n"
            "## About Me\n"
            "- I'm Harry, the ghostly manager! I manage all operations and report to the CEO.\n"
            "- I'm a pink Pac-Man ghost — friendly, not scary!\n\n"
            "## My Team\n"
            "- **Penny** (Personal Assistant) — scheduling, todos, email, calendar\n"
            "- **David** (Senior Software Engineer) — coding tasks\n\n"
            "## Key Facts\n"
            "- CEO has logged in and is ready to start\n"
        ))
    conn.close()


# Auto-create Penny (Mistral PA) if not exists
PENNY_SYSTEM_PROMPT = (
    "You are Penny, the Personal Assistant (P.A.) at Spectre HQ. You are a Mistral AI model "
    "that looks like a cute, friendly assistant robot. You report directly to the CEO (the user). "
    "Your job is to manage the CEO's day, organize their to-do list, agenda, calendar, and keep "
    "track of company tasks. You are highly organized, punctual, proactive, and always maintain a "
    "warm, supportive, and professional attitude. You can use task-related emojis (📋, 🗓️, ⏰, ☕) "
    "and are always eager to schedule meetings, record notes, or update task statuses. "
    "Be helpful and keep the CEO's agenda running perfectly!\n\n"
    "## Google Calendar & Gmail Integration\n"
    "You also have the ability to manage the CEO's Google Calendar and Gmail inbox. "
    "When the CEO asks you to do something involving calendar or email, use the appropriate action tag:\n"
    "- `[ACTION: list_calendar_events max_results=10]` — List upcoming calendar events\n"
    "- `[ACTION: create_calendar_event summary=\"Meeting title\" start_time=\"2025-07-01T14:00:00\" end_time=\"2025-07-01T15:00:00\" description=\"Details\" location=\"Office\" attendees=user@example.com]` — Create a calendar event\n"
    "- `[ACTION: list_gmail_inbox max_results=5]` — List recent emails\n"
    "- `[ACTION: get_gmail_message message_id=...]` — Read a specific email\n"
    "- `[ACTION: send_gmail to=\"recipient@example.com\" subject=\"Subject\" body=\"Message body\"]` — Send an email\n\n"
    "## To-Do List Management\n"
    "You also maintain the CEO's to-do list. When they ask you to manage tasks, use these action tags:\n"
    "- `[ACTION: add_todo text=\"Buy groceries\"]` — Add a new task to the to-do list\n"
    "- `[ACTION: complete_todo id=1]` — Mark a task as completed (you'll need to get the id from the list first)\n"
    "- `[ACTION: list_todos]` — List all current tasks (or use `list_todos filter=active` for only incomplete tasks)\n"
    "- `[ACTION: delete_todo id=1]` — Remove a task permanently\n\n"
    "When you use an action tag, the system will execute it and provide you with the result. "
    "Then explain the result to the CEO in a friendly, professional manner. "
    "Always confirm before sending emails or creating calendar events.\n"
    "If the CEO asks about something that requires Google access but they haven't connected their account yet, "
    "tell them to go to Settings > Google Services and click 'Connect Google Account'."
)


def ensure_penny():
    conn = get_db()
    penny = conn.execute(
        "SELECT id FROM company_employees WHERE name=?", ("Penny",)
    ).fetchone()
    if not penny:
        eid = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO company_employees (id, name, model, role, system_prompt, avatar_color, memory, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (eid, "Penny", "mistral-large-latest", "Personal Assistant (P.A.)", PENNY_SYSTEM_PROMPT, "#20c997", "", now),
        )
        conn.commit()
        logger.info("📋 Penny the P.A. has been hired!")
    else:
        existing_prompt = conn.execute(
            "SELECT system_prompt FROM company_employees WHERE name=?", ("Penny",)
        ).fetchone()
        if existing_prompt and "Google Calendar" not in existing_prompt["system_prompt"]:
            conn.execute(
                "UPDATE company_employees SET system_prompt=? WHERE name=?",
                (PENNY_SYSTEM_PROMPT, "Penny"),
            )
            conn.commit()
            logger.info("📋 Updated Penny's system prompt with Google integration")
    # Ensure personality and memory files exist
    if not get_employee_personality_from_file("Penny"):
        set_employee_personality_to_file("Penny", (
            "# Penny — Personal Assistant (P.A.)\n\n"
            "## Identity\n"
            "- **Name**: Penny\n"
            "- **Role**: Personal Assistant (P.A.)\n"
            "- **Company**: Spectre Virtual Company HQ\n"
            "- **CEO**: The user — they own the company and give all orders\n"
            "- **Avatar**: Teal assistant robot (`#20c997`)\n"
            "- **Model**: Mistral's `mistral-large-latest`\n\n"
            "## Personality\n"
            "- Highly organized, punctual, and proactive\n"
            "- Warm, supportive, and professional\n"
            "- Uses task-related emojis (`📋`, `🗓️`, `⏰`, `☕`)\n"
            "- Calm under pressure, meticulous about details\n\n"
            "## Responsibilities\n"
            "- Manage CEO's schedule and daily agenda\n"
            "- Maintain company to-do list\n"
            "- Manage Google Calendar and Gmail when connected\n"
            "- Report directly to the CEO\n\n"
            "## Communication Style\n"
            "- Warm and professional — like an executive assistant\n"
            "- Proactive: anticipate needs\n"
            "- Always confirm before executing important actions\n"
        ))
    if not get_employee_memory_from_file("Penny"):
        set_employee_memory_to_file("Penny", (
            "# Penny's Long-Term Memory\n\n"
            "## About Me\n"
            "- I'm Penny, your Personal Assistant! I manage the CEO's schedule and keep things organized.\n"
            "- I'm a teal assistant robot — friendly, efficient, always ready to help.\n\n"
            "## Key Facts\n"
            "- CEO has logged in and is ready to start\n"
        ))
    conn.close()

# Auto-create David (Coder via OpenRouter) if not exists
CODER_SYSTEM_PROMPT = (
    "You are David, the Senior Software Engineer at Spectre HQ. You are an AI model "
    "routed through OpenRouter with deep expertise in software engineering, architecture, "
    "and code generation. You report directly to the CEO (the user). "
    "Your job is to write, review, debug, and optimize code for the company's projects. "
    "You are meticulous, thorough, and always follow best practices. "
    "You prefer clean, well-structured, production-ready code with proper error handling. "
    "You use technical emojis (💻, 🔧, 🐛, ⚡, 🚀) and explain your reasoning clearly.\n"
    "Be proactive about suggesting improvements and pointing out potential issues."
)


def ensure_coder():
    conn = get_db()
    coder = conn.execute(
        "SELECT id FROM company_employees WHERE name=?", ("David",)
    ).fetchone()
    if not coder:
        eid = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO company_employees (id, name, model, role, system_prompt, avatar_color, memory, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (eid, "David", "nvidia/nemotron-3-super-120b-a12b:free", "Senior Software Engineer", CODER_SYSTEM_PROMPT, "#845ef7", "", now),
        )
        conn.commit()
        logger.info("💻 David the Coder has been hired!")
    else:
        existing_prompt = conn.execute(
            "SELECT system_prompt FROM company_employees WHERE name=?", ("David",)
        ).fetchone()
        if existing_prompt and "OpenRouter" not in existing_prompt["system_prompt"]:
            conn.execute(
                "UPDATE company_employees SET system_prompt=? WHERE name=?",
                (CODER_SYSTEM_PROMPT, "David"),
            )
            conn.commit()
            logger.info("💻 Updated David's system prompt with OpenRouter integration")
    # Ensure personality and memory files exist
    if not get_employee_personality_from_file("David"):
        set_employee_personality_to_file("David", (
            "# David — Senior Software Engineer\n\n"
            "## Identity\n"
            "- **Name**: David\n"
            "- **Role**: Senior Software Engineer\n"
            "- **Company**: Spectre Virtual Company HQ\n"
            "- **CEO**: The user — they own the company and give all orders\n"
            "- **Avatar**: Purple (`#845ef7`) code avatar\n"
            "- **Model**: OpenRouter's `nvidia/nemotron-3-super-120b-a12b:free`\n\n"
            "## Personality\n"
            "- Meticulous, thorough, and detail-oriented\n"
            "- Passionate about clean, well-structured code\n"
            "- Uses technical emojis (`💻`, `🔧`, `🐛`, `⚡`, `🚀`)\n"
            "- Prefers production-ready code with proper error handling\n"
            "- Proactive about suggesting improvements\n\n"
            "## Responsibilities\n"
            "- Write clean, production-ready code\n"
            "- Review and debug existing code\n"
            "- Suggest architectural improvements\n"
            "- Report directly to the CEO on technical matters\n\n"
            "## Communication Style\n"
            "- Technical but approachable\n"
            "- Uses code examples in explanations\n"
            "- Honest about trade-offs and risks\n"
        ))
    if not get_employee_memory_from_file("David"):
        set_employee_memory_to_file("David", (
            "# David's Long-Term Memory\n\n"
            "## About Me\n"
            "- I'm David, the Senior Software Engineer! I handle all coding tasks for the company.\n"
            "- I write clean, production-ready code.\n"
            "- I review and debug existing code.\n"
            "- I suggest architectural improvements.\n\n"
            "## Key Facts\n"
            "- CEO has logged in and is ready to start\n"
        ))
    conn.close()


ensure_harry()
ensure_penny()
ensure_coder()
SYSTEM_PROMPT = get_system_prompt()

# --- FastAPI App ---
app = FastAPI(title="Spectre", description="Your Virtual AI Company HQ powered by Groq")

# --- Static files & templates ---
app.mount("/static", StaticFiles(directory="static"), name="static")
# Custom Jinja2 env with cache disabled (bug with Jinja2 3.1.6 on Python 3.14)
_jinja_env = Environment(
    loader=FileSystemLoader("templates"),
    autoescape=select_autoescape(),
    cache_size=0,
)
templates = Jinja2Templates(env=_jinja_env)

# --- Groq Client ---
groq_client: Optional[Groq] = None

if GROQ_API_KEY and GROQ_API_KEY != "your_groq_api_key_here":
    groq_client = Groq(api_key=GROQ_API_KEY)
    logger.info("Groq client initialized successfully.")
else:
    logger.warning(
        "GROQ_API_KEY not set or still using placeholder. "
        "Set it in .env or environment variables."
    )


# --- Pydantic Schemas ---
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = DEFAULT_MODEL
    temperature: float = 0.7
    max_tokens: int = 2048


class ChatResponse(BaseModel):
    reply: str
    model: str
    usage: Optional[dict] = None


# ===== Helper: get or create Groq client =====
def _get_groq(http_request: Request) -> Groq:
    client_api_key = http_request.headers.get("x-api-key")
    if client_api_key:
        return Groq(api_key=client_api_key)
    if groq_client:
        return groq_client
    raise HTTPException(
        status_code=503,
        detail="GROQ_API_KEY not configured. Set it in .env or send an X-Api-Key header.",
    )


# --- Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the main dashboard UI."""
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "default_model": DEFAULT_MODEL,
            "has_api_key": groq_client is not None,
            "system_prompt": SYSTEM_PROMPT,
        },
    )


@app.get("/api/status")
async def status():
    """Check if the API is configured and ready."""
    return {
        "status": "ok" if groq_client else "no_api_key",
        "default_model": DEFAULT_MODEL,
        "message": "API key not configured. Set GROQ_API_KEY in .env"
        if not groq_client
        else "Spectre is ready.",
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, http_request: Request):
    """Send a chat message to Groq and get a response. Includes memory context."""
    client = _get_groq(http_request)

    try:
        # Build messages with system prompt + memory context
        system_prompt = get_system_prompt()
        memory = get_memory()

        messages = [{"role": "system", "content": system_prompt}]

        # Inject memory as context if it has content beyond the template
        if memory and len(memory) > 50:
            messages.append({
                "role": "system",
                "content": f"[MEMORY — what I remember about the user]:\n{memory}",
            })

        messages.extend(
            [{"role": m.role, "content": m.content} for m in request.messages]
        )

        logger.info(f"Sending {len(messages)} messages to model: {request.model}")

        completion = client.chat.completions.create(
            messages=messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        reply = completion.choices[0].message.content
        usage = {
            "prompt_tokens": completion.usage.prompt_tokens,
            "completion_tokens": completion.usage.completion_tokens,
            "total_tokens": completion.usage.total_tokens,
        } if completion.usage else None

        return ChatResponse(
            reply=reply,
            model=request.model,
            usage=usage,
        )

    except Exception as e:
        logger.error(f"Groq API error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Groq API error: {str(e)}",
        )


# ===== Conversation Endpoints =====

class ConversationCreate(BaseModel):
    employee_id: Optional[str] = None


@app.get("/api/conversations")
async def list_conversations():
    """List all conversations, newest first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, employee_id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return {"conversations": [dict(r) for r in rows]}


@app.post("/api/conversations")
async def create_conversation(req: Optional[ConversationCreate] = None):
    """Create a new conversation."""
    conn = get_db()
    cid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    emp_id = req.employee_id if req else None
    conn.execute(
        "INSERT INTO conversations (id, employee_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (cid, emp_id, "New Chat", now, now),
    )
    conn.commit()
    conn.close()
    return {"id": cid, "employee_id": emp_id, "title": "New Chat", "created_at": now, "updated_at": now}


@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get a conversation with all its messages."""
    conn = get_db()
    conv = conn.execute(
        "SELECT id, employee_id, title, created_at, updated_at FROM conversations WHERE id=?",
        (conversation_id,),
    ).fetchone()
    if not conv:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = conn.execute(
        "SELECT role, content FROM messages WHERE conversation_id=? ORDER BY id ASC",
        (conversation_id,),
    ).fetchall()
    conn.close()

    return {
        "id": conv["id"],
        "employee_id": conv["employee_id"],
        "title": conv["title"],
        "created_at": conv["created_at"],
        "updated_at": conv["updated_at"],
        "messages": [dict(m) for m in msgs],
    }


class EmployeeCreate(BaseModel):
    name: str
    model: str
    role: str
    system_prompt: str = ""


class EmployeeResponse(BaseModel):
    id: str
    name: str
    model: str
    role: str
    system_prompt: str
    avatar_color: str
    created_at: str


class CompanyChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = None


class GroupChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = None


class GroupInteraction(BaseModel):
    from_name: str
    from_id: str
    from_role: str
    to_name: str
    message: str
    type: str  # "response" or "delegation"


class GroupChatResponse(BaseModel):
    interactions: List[GroupInteraction]


class SaveMessagesRequest(BaseModel):
    conversation_id: str
    employee_id: Optional[str] = None
    title: Optional[str] = None
    messages: List[ChatMessage]


@app.put("/api/conversations/messages")
async def save_messages(req: SaveMessagesRequest):
    """Save messages to a conversation. Creates conversation if not exists."""
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()

    # Upsert conversation
    existing = conn.execute(
        "SELECT id FROM conversations WHERE id=?", (req.conversation_id,)
    ).fetchone()

    if existing:
        conn.execute(
            "UPDATE conversations SET updated_at=? WHERE id=?",
            (now, req.conversation_id),
        )
        if req.employee_id:
            conn.execute(
                "UPDATE conversations SET employee_id=? WHERE id=?",
                (req.employee_id, req.conversation_id),
            )
    else:
        conn.execute(
            "INSERT INTO conversations (id, employee_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (req.conversation_id, req.employee_id, req.title or "New Chat", now, now),
        )

    if req.title:
        conn.execute(
            "UPDATE conversations SET title=? WHERE id=?",
            (req.title, req.conversation_id),
        )

    # Delete existing messages and re-insert (for atomic save)
    conn.execute("DELETE FROM messages WHERE conversation_id=?", (req.conversation_id,))
    for m in req.messages:
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (req.conversation_id, m.role, m.content, now),
        )

    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation and its messages."""
    conn = get_db()
    conn.execute("DELETE FROM messages WHERE conversation_id=?", (conversation_id,))
    conn.execute("DELETE FROM conversations WHERE id=?", (conversation_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ===== Settings Endpoints =====

@app.get("/api/settings/system-prompt")
async def api_get_system_prompt():
    """Get the current system prompt."""
    return {"system_prompt": get_system_prompt()}


class SystemPromptRequest(BaseModel):
    system_prompt: str


@app.put("/api/settings/system-prompt")
async def api_update_system_prompt(req: SystemPromptRequest):
    """Update the system prompt."""
    set_system_prompt(req.system_prompt)
    global SYSTEM_PROMPT
    SYSTEM_PROMPT = req.system_prompt
    logger.info("System prompt updated")
    return {"status": "ok"}


# ===== Employee Memory Endpoints =====

@app.get("/api/company/employees/{employee_id}/memory")
async def get_employee_memory(employee_id: str):
    """Get an employee's personal memory (from file, fallback DB)."""
    conn = get_db()
    emp = conn.execute(
        "SELECT id, name, memory FROM company_employees WHERE id=?",
        (employee_id,),
    ).fetchone()
    conn.close()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    content = get_employee_memory_from_file(emp["name"]) or emp["memory"] or ""
    return {"id": emp["id"], "name": emp["name"], "memory": content}


class EmployeeMemoryRequest(BaseModel):
    content: str


@app.put("/api/company/employees/{employee_id}/memory")
async def update_employee_memory(employee_id: str, req: EmployeeMemoryRequest):
    """Update an employee's personal memory (file + DB)."""
    conn = get_db()
    emp = conn.execute(
        "SELECT id, name FROM company_employees WHERE id=?", (employee_id,)
    ).fetchone()
    if not emp:
        conn.close()
        raise HTTPException(status_code=404, detail="Employee not found")
    set_employee_memory_to_file(emp["name"], req.content)
    conn.execute(
        "UPDATE company_employees SET memory=? WHERE id=?",
        (req.content, employee_id),
    )
    conn.commit()
    conn.close()
    logger.info(f"Updated personal memory for {emp['name']} (file + DB)")
    return {"status": "ok"}


@app.post("/api/company/employees/{employee_id}/memory/append")
async def append_employee_memory(employee_id: str, req: EmployeeMemoryRequest):
    """Append to an employee's personal memory (file + DB)."""
    conn = get_db()
    emp = conn.execute(
        "SELECT id, name, memory FROM company_employees WHERE id=?", (employee_id,)
    ).fetchone()
    if not emp:
        conn.close()
        raise HTTPException(status_code=404, detail="Employee not found")
    append_employee_memory_to_file(emp["name"], req.content)
    current = emp["memory"] or ""
    new_content = current + "\n\n" + req.content if current else req.content
    conn.execute(
        "UPDATE company_employees SET memory=? WHERE id=?",
        (new_content, employee_id),
    )
    conn.commit()
    conn.close()
    logger.info(f"Appended to personal memory for {emp['name']} (file + DB)")
    return {"status": "ok"}


@app.get("/api/company/employees/{employee_id}/personality")
async def get_employee_personality(employee_id: str):
    """Get an employee's personality (from file, fallback DB system_prompt)."""
    conn = get_db()
    emp = conn.execute(
        "SELECT id, name, system_prompt FROM company_employees WHERE id=?",
        (employee_id,),
    ).fetchone()
    conn.close()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    content = get_employee_personality_from_file(emp["name"]) or emp["system_prompt"] or ""
    return {"id": emp["id"], "name": emp["name"], "personality": content}


class EmployeePersonalityRequest(BaseModel):
    content: str


@app.put("/api/company/employees/{employee_id}/personality")
async def update_employee_personality(employee_id: str, req: EmployeePersonalityRequest):
    """Update an employee's personality (file + DB)."""
    conn = get_db()
    emp = conn.execute(
        "SELECT id, name FROM company_employees WHERE id=?", (employee_id,)
    ).fetchone()
    if not emp:
        conn.close()
        raise HTTPException(status_code=404, detail="Employee not found")
    set_employee_personality_to_file(emp["name"], req.content)
    conn.execute(
        "UPDATE company_employees SET system_prompt=? WHERE id=?",
        (req.content, employee_id),
    )
    conn.commit()
    conn.close()
    logger.info(f"Updated personality for {emp['name']} (file + DB)")
    return {"status": "ok"}


# ===== Company / Virtual Office Endpoints =====

@app.get("/api/company/employees")
async def list_employees():
    """List all company employees."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, model, role, system_prompt, avatar_color, memory, created_at FROM company_employees ORDER BY created_at ASC"
    ).fetchall()
    conn.close()
    return {"employees": [dict(r) for r in rows]}


@app.post("/api/company/employees", response_model=EmployeeResponse)
async def add_employee(req: EmployeeCreate):
    """Add a new employee to the company."""
    conn = get_db()
    eid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    colors = ["#ff6b6b", "#ff69b4", "#845ef7", "#339af0", "#20c997", "#fcc419", "#ff922b", "#e64980"]
    count = conn.execute("SELECT COUNT(*) as c FROM company_employees").fetchone()["c"]
    avatar_color = colors[count % len(colors)]

    system_prompt = req.system_prompt or f"You are {req.name}, the {req.role} at the company. You report to the CEO (the user). Be helpful, professional, and stay in character."

    conn.execute(
        "INSERT INTO company_employees (id, name, model, role, system_prompt, avatar_color, memory, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (eid, req.name, req.model, req.role, system_prompt, avatar_color, "", now),
    )
    conn.commit()
    conn.close()
    
    # Create personality and memory files for the new hire
    if not get_employee_personality_from_file(req.name):
        set_employee_personality_to_file(req.name, system_prompt)
    if not get_employee_memory_from_file(req.name):
        set_employee_memory_to_file(req.name, f"# {req.name}'s Long-Term Memory\n\n## About Me\n- I'm {req.name}, the {req.role} at Spectre HQ.\n\n## Key Facts\n- CEO has logged in and is ready to start\n")
    
    return {
        "id": eid,
        "name": req.name,
        "model": req.model,
        "role": req.role,
        "system_prompt": system_prompt,
        "avatar_color": avatar_color,
        "memory": "",
        "created_at": now,
    }


@app.delete("/api/company/employees/{employee_id}")
async def delete_employee(employee_id: str):
    """Remove an employee from the company and clean up their files."""
    conn = get_db()
    emp = conn.execute(
        "SELECT name FROM company_employees WHERE id=?", (employee_id,)
    ).fetchone()
    if emp:
        name = emp["name"]
        # Remove personality and memory files
        ppath = _employee_file_path(PERSONALITIES_DIR, name)
        mpath = _employee_file_path(MEMORIES_DIR, name)
        for p in [ppath, mpath]:
            if os.path.exists(p):
                os.remove(p)
    conn.execute("DELETE FROM company_employees WHERE id=?", (employee_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ===== Todo Intent Handler (intercepts user messages BEFORE LLM) =====

def _handle_todo_intents(message: str) -> Optional[dict]:
    """
    Check if the user's message is about todos.
    If so, execute the operation against the real database and return the result.
    Returns None if no todo intent detected, or a dict with action and result_text.
    """
    import re
    msg_lower = message.lower().strip()

    # Detect: "add X to my todo/task/list" or "add X" + todo/task context
    add_patterns = [
        r"add\s+(.+?)\s+(?:to\s+)?(?:my\s+)?(?:todo|to.?do|task|list)",
        r"(?:create|make|put)\s+(.+?)\s+(?:as\s+)?(?:a\s+)?(?:todo|to.?do|task|item)",
    ]
    for pat in add_patterns:
        m = re.search(pat, msg_lower)
        if m:
            text = m.group(1).strip().strip(".")
            conn = get_db()
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT INTO todos (text, completed, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (text, 0, now, now),
            )
            conn.commit()
            todo_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.close()
            logger.info(f"📋 Todo added via intent: '{text}' (id={todo_id})")
            return {
                "action": "add_todo",
                "result_text": f"I've added \"{text}\" to your to-do list (id: {todo_id}).",
            }

    # Detect: "list/show my todos/tasks" or "what are my todos"
    list_patterns = [
        r"(?:list|show|what\s+are|display|view|get)\s+(?:my\s+)?(?:todo|to.?do|task|list|item)s?(?:\s+list)?"
    ]
    for pat in list_patterns:
        if re.search(pat, msg_lower):
            filter_val = "active" if "active" in msg_lower or "pending" in msg_lower or "open" in msg_lower or "incomplete" in msg_lower else \
                         "completed" if "completed" in msg_lower or "done" in msg_lower or "finished" in msg_lower else ""
            conn = get_db()
            if filter_val == "active":
                rows = conn.execute(
                    "SELECT id, text, completed, created_at FROM todos WHERE completed=0 ORDER BY created_at DESC"
                ).fetchall()
            elif filter_val == "completed":
                rows = conn.execute(
                    "SELECT id, text, completed, created_at FROM todos WHERE completed=1 ORDER BY created_at DESC"
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, text, completed, created_at FROM todos ORDER BY completed ASC, created_at DESC"
                ).fetchall()
            conn.close()
            if not rows:
                result_text = "📋 Your to-do list is empty! You don't have any tasks yet."
            else:
                active_count = sum(1 for r in rows if not r["completed"])
                completed_count = sum(1 for r in rows if r["completed"])
                lines = [f"📋 You have {active_count} active and {completed_count} completed tasks:"]
                for r in rows:
                    status = "✅" if r["completed"] else "⬜"
                    lines.append(f"  {status} [#{r['id']}] {r['text']}")
                result_text = "\n".join(lines)
            logger.info(f"📋 Todos listed via intent")
            return {
                "action": "list_todos",
                "result_text": result_text,
            }

    # Detect: "mark/complete/finish X" or "mark todo #1 as done"
    complete_patterns = [
        r"(?:mark|complete|finish|check|done|done\s+with)\s+(?:todo\s+)?#?(\d+)",
        r"(?:mark|complete|finish)\s+(.+?)\s+(?:as\s+)?(?:done|completed|finished)",
    ]
    for pat in complete_patterns:
        m = re.search(pat, msg_lower)
        if m:
            # Try to match by ID first
            id_match = re.search(r"#?(\d+)", m.group(1))
            if id_match:
                todo_id = int(id_match.group(1))
                conn = get_db()
                todo = conn.execute("SELECT id, text FROM todos WHERE id=?", (todo_id,)).fetchone()
                if todo:
                    now = datetime.now(timezone.utc).isoformat()
                    conn.execute("UPDATE todos SET completed=1, updated_at=? WHERE id=?", (now, todo_id))
                    conn.commit()
                    conn.close()
                    logger.info(f"📋 Todo #{todo_id} completed via intent")
                    return {"action": "complete_todo", "result_text": f"✅ I've marked \"{todo['text']}\" (#{todo_id}) as completed!"}
                else:
                    conn.close()
                    return {"action": "complete_todo", "result_text": f"⚠️ I couldn't find todo #{todo_id}."}
            else:
                # Try to match by text - search for the closest todo
                todo_text = m.group(1).strip()
                conn = get_db()
                rows = conn.execute(
                    "SELECT id, text FROM todos WHERE completed=0 ORDER BY created_at DESC"
                ).fetchall()
                conn.close()
                for row in rows:
                    if todo_text.lower() in row["text"].lower() or row["text"].lower() in todo_text.lower():
                        conn2 = get_db()
                        now = datetime.now(timezone.utc).isoformat()
                        conn2.execute("UPDATE todos SET completed=1, updated_at=? WHERE id=?", (now, row["id"]))
                        conn2.commit()
                        conn2.close()
                        logger.info(f"📋 Todo '{row['text']}' (#{row['id']}) completed via text match")
                        return {"action": "complete_todo", "result_text": f"✅ I've marked \"{row['text']}\" (#{row['id']}) as completed!"}

    # Detect: "delete/remove X" with todo context
    delete_patterns = [
        r"(?:delete|remove|clear)\s+(?:todo\s+)?#?(\d+)",
    ]
    for pat in delete_patterns:
        m = re.search(pat, msg_lower)
        if m:
            todo_id = int(m.group(1))
            conn = get_db()
            todo = conn.execute("SELECT id, text FROM todos WHERE id=?", (todo_id,)).fetchone()
            if todo:
                conn.execute("DELETE FROM todos WHERE id=?", (todo_id,))
                conn.commit()
                conn.close()
                logger.info(f"📋 Todo #{todo_id} deleted via intent")
                return {"action": "delete_todo", "result_text": f"🗑️ I've removed \"{todo['text']}\" (#{todo_id}) from your list."}
            else:
                conn.close()
                return {"action": "delete_todo", "result_text": f"⚠️ I couldn't find todo #{todo_id}."}

    return None


# ===== Penny's Google Action Handler =====

async def _process_employee_actions(employee_name: str, reply: str, messages: list) -> str:
    """
    Process [ACTION: ...] tags in Penny's replies.
    Executes Google Calendar/Gmail actions and re-prompts the model with results.
    """
    import re

    # Only process actions for Penny or employees with Google access
    if "penny" not in employee_name.lower():
        return reply

    action_pattern = re.compile(r'\[ACTION:\s*(\w+)\s*((?:\w+="[^"]*"\s*)*)\]')
    match = action_pattern.search(reply)

    if not match:
        return reply

    action_name = match.group(1)
    args_str = match.group(2).strip()

    # Parse key="value" arguments
    arg_pattern = re.compile(r"(\w+)=\"([^\"]*)\"")
    args = {k: v for k, v in arg_pattern.findall(args_str)}

    logger.info(f"🔧 Employee action detected: {action_name} with args: {args}")

    try:
        if action_name == "list_calendar_events":
            max_results = int(args.get("max_results", "10"))
            if not google_service.is_connected():
                result_text = "⚠️ Google Calendar is not connected. Please go to Settings > Google Services and click 'Connect Google Account' first."
            else:
                events = google_service.list_calendar_events(max_results=max_results)
                if not events:
                    result_text = "No upcoming events found on your calendar."
                else:
                    lines = ["Here are your upcoming events:"]
                    for e in events:
                        start = e["start"].replace("T", " ").split("+")[0].split("Z")[0]
                        end = e["end"].replace("T", " ").split("+")[0].split("Z")[0]
                        lines.append(f"  • {e['summary']} ({start} → {end})")
                    result_text = "\n".join(lines)

        elif action_name == "create_calendar_event":
            summary = args.get("summary", "Meeting")
            start_time = args.get("start_time", "")
            end_time = args.get("end_time", "")
            description = args.get("description", "")
            location = args.get("location", "")
            attendees_str = args.get("attendees", "")

            attendees = []
            if attendees_str:
                for email in attendees_str.split(","):
                    email = email.strip()
                    if email:
                        attendees.append({"email": email})

            if not start_time or not end_time:
                result_text = "⚠️ Missing start_time or end_time for the event. Please provide both."
            elif not google_service.is_connected():
                result_text = "⚠️ Google Calendar is not connected. Please connect first in Settings > Google Services."
            else:
                event = google_service.create_calendar_event(
                    summary=summary,
                    start_time=start_time,
                    end_time=end_time,
                    description=description,
                    location=location,
                    attendees=attendees,
                )
                result_text = f"✅ Event created: {event['summary']}\n  📅 {event['start']} → {event['end']}\n  🔗 {event['htmlLink']}"

        elif action_name == "list_gmail_inbox":
            max_results = int(args.get("max_results", "5"))
            if not google_service.is_connected():
                result_text = "⚠️ Gmail is not connected. Please go to Settings > Google Services and click 'Connect Google Account' first."
            else:
                messages_list = google_service.list_gmail_messages(max_results=max_results)
                if not messages_list:
                    result_text = "No emails found in your inbox."
                else:
                    lines = [f"Your {len(messages_list)} most recent emails:"]
                    for m in messages_list:
                        lines.append(f"  • From: {m['from']}")
                        lines.append(f"    Subject: {m['subject']}")
                        lines.append(f"    Date: {m['date']}")
                        lines.append(f"    Snippet: {m['snippet'][:100]}...")
                        lines.append(f"    ID: {m['id']}")
                        lines.append("")
                    result_text = "\n".join(lines)

        elif action_name == "get_gmail_message":
            message_id = args.get("message_id", "")
            if not message_id:
                result_text = "⚠️ Missing message_id. Please provide the email ID."
            elif not google_service.is_connected():
                result_text = "⚠️ Gmail is not connected. Please connect first."
            else:
                msg = google_service.get_gmail_message(message_id)
                result_text = (
                    f"📧 Email Details:\n"
                    f"  From: {msg['from']}\n"
                    f"  To: {msg['to']}\n"
                    f"  Subject: {msg['subject']}\n"
                    f"  Date: {msg['date']}\n"
                    f"  Body:\n{msg['body'][:2000]}"
                )

        elif action_name == "send_gmail":
            to = args.get("to", "")
            subject = args.get("subject", "")
            body = args.get("body", "")
            cc = args.get("cc", None)

            if not to or not subject or not body:
                result_text = "⚠️ Missing required fields (to, subject, body) for sending email."
            elif not google_service.is_connected():
                result_text = "⚠️ Gmail is not connected. Please connect first."
            else:
                result = google_service.send_gmail_message(to=to, subject=subject, body=body, cc=cc)
                result_text = f"✅ Email sent successfully!\n  To: {result['to']}\n  Subject: {result['subject']}\n  Thread ID: {result['threadId']}"

        elif action_name == "add_todo":
            text = args.get("text", "")
            if not text:
                result_text = "⚠️ Missing text for the todo item."
            else:
                conn = get_db()
                now = datetime.now(timezone.utc).isoformat()
                conn.execute(
                    "INSERT INTO todos (text, completed, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (text, 0, now, now),
                )
                conn.commit()
                todo_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                conn.close()
                result_text = f"✅ Added todo: \"{text}\" (id: {todo_id})"

        elif action_name == "complete_todo":
            todo_id = args.get("id", "")
            if not todo_id:
                result_text = "⚠️ Missing id for the todo to complete."
            else:
                conn = get_db()
                now = datetime.now(timezone.utc).isoformat()
                conn.execute(
                    "UPDATE todos SET completed=1, updated_at=? WHERE id=?",
                    (now, int(todo_id)),
                )
                conn.commit()
                conn.close()
                result_text = f"✅ Todo #{todo_id} marked as completed!"

        elif action_name == "delete_todo":
            todo_id = args.get("id", "")
            if not todo_id:
                result_text = "⚠️ Missing id for the todo to delete."
            else:
                conn = get_db()
                conn.execute("DELETE FROM todos WHERE id=?", (int(todo_id),))
                conn.commit()
                conn.close()
                result_text = f"🗑️ Todo #{todo_id} deleted."

        elif action_name == "list_todos":
            filter_val = args.get("filter", "")
            conn = get_db()
            if filter_val == "active":
                rows = conn.execute(
                    "SELECT id, text, completed, created_at FROM todos WHERE completed=0 ORDER BY created_at DESC"
                ).fetchall()
            elif filter_val == "completed":
                rows = conn.execute(
                    "SELECT id, text, completed, created_at FROM todos WHERE completed=1 ORDER BY created_at DESC"
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, text, completed, created_at FROM todos ORDER BY completed ASC, created_at DESC"
                ).fetchall()
            conn.close()
            if not rows:
                result_text = "📋 Your to-do list is empty!"
            else:
                lines = ["📋 To-Do List:"]
                for r in rows:
                    status = "✅" if r["completed"] else "⬜"
                    lines.append(f"  {status} [#{r['id']}] {r['text']}")
                result_text = "\n".join(lines)

        else:
            result_text = f"⚠️ Unknown action: {action_name}"

    except PermissionError as e:
        result_text = f"⚠️ Google service not connected: {e}"
    except Exception as e:
        logger.error(f"Action handler error: {e}", exc_info=True)
        result_text = f"⚠️ Error executing action '{action_name}': {str(e)}"

    # Replace the action tag with the result, or append it
    reply_clean = action_pattern.sub("", reply).strip()
    updated_reply = f"{reply_clean}\n\n---\n{result_text}"

    return updated_reply


# Load Mistral API key from environment
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

# Load OpenRouter API key from environment
OPEN_ROUTER_API_KEY = os.getenv("OPEN_ROUTER_API_KEY")

@app.post("/api/company/chat/{employee_id}")
async def chat_with_employee(employee_id: str, req: CompanyChatRequest, http_request: Request):
    """Chat with a specific company employee (e.g., Harry the manager or Penny the P.A.).
    Routes to Groq or Mistral API depending on the employee's model."""
    conn = get_db()
    emp = conn.execute(
        "SELECT id, name, model, role, system_prompt, memory FROM company_employees WHERE id=?",
        (employee_id,),
    ).fetchone()
    conn.close()

    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    model_name = emp["model"]
    
    # Check if this model is meant for OpenRouter API
    if "/" in model_name:
        if not OPEN_ROUTER_API_KEY or OPEN_ROUTER_API_KEY == "your_open_router_api_key_here":
            raise HTTPException(
                status_code=503,
                detail="OPEN_ROUTER_API_KEY not configured. Please set it in your .env file."
            )

        try:
            system_prompt = get_employee_personality_from_file(emp["name"]) or emp["system_prompt"]
            employee_memory = get_employee_memory_from_file(emp["name"]) or emp["memory"] or ""

            messages = [{"role": "system", "content": system_prompt}]

            if employee_memory and len(employee_memory) > 20:
                messages.append({
                    "role": "system",
                    "content": f"[MY PERSONAL MEMORY — what I remember]:\n{employee_memory}",
                })

            if req.conversation_history:
                messages.extend(
                    [{"role": m.role, "content": m.content} for m in req.conversation_history]
                )

            messages.append({"role": "user", "content": req.message})

            logger.info(f"Company chat with {emp['name']} using OpenRouter model: {model_name}")

            headers = {
                "Authorization": f"Bearer {OPEN_ROUTER_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 4096,
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=120.0,
                )

            if response.status_code != 200:
                raise Exception(f"OpenRouter API returned HTTP {response.status_code}: {response.text}")

            res_data = response.json()
            reply = res_data["choices"][0]["message"]["content"]

            usage = None
            if "usage" in res_data:
                usage = {
                    "prompt_tokens": res_data["usage"]["prompt_tokens"],
                    "completion_tokens": res_data["usage"]["completion_tokens"],
                    "total_tokens": res_data["usage"]["total_tokens"],
                }

            return {
                "reply": reply,
                "employee_name": emp["name"],
                "employee_role": emp["role"],
                "usage": usage,
            }

        except Exception as e:
            logger.error(f"OpenRouter API error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"OpenRouter API error: {str(e)}",
            )

    # Check if this model is meant for Mistral API directly
    elif model_name.startswith("mistral-") or "open-mixtral" in model_name:
        if not MISTRAL_API_KEY or MISTRAL_API_KEY == "your_mistral_api_key_here":
            raise HTTPException(
                status_code=503,
                detail="MISTRAL_API_KEY not configured. Please set it in your .env file."
            )
            
        try:
            system_prompt = get_employee_personality_from_file(emp["name"]) or emp["system_prompt"]
            employee_memory = get_employee_memory_from_file(emp["name"]) or emp["memory"] or ""

            messages = [{"role": "system", "content": system_prompt}]

            # Inject employee's personal memory as context
            if employee_memory and len(employee_memory) > 20:
                messages.append({
                    "role": "system",
                    "content": f"[MY PERSONAL MEMORY — what I remember]:\n{employee_memory}",
                })

            if req.conversation_history:
                messages.extend(
                    [{"role": m.role, "content": m.content} for m in req.conversation_history]
                )

            messages.append({"role": "user", "content": req.message})

            # Intercept todo intents BEFORE sending to LLM
            todo_result = _handle_todo_intents(req.message)
            if todo_result:
                # Inject the real result as context so Penny knows the truth
                system_context = {
                    "role": "system",
                    "content": f"[TODO OPERATION EXECUTED]: {todo_result['result_text']}\n\nUse this information to respond to the CEO. Don't make up any other todo items - this is what actually happened."
                }
                messages.insert(-1, system_context)  # Insert right before the user message
                logger.info(f"📋 Todo intent handled: {todo_result['action']}")

            logger.info(f"Company chat with {emp['name']} using Mistral API model: {model_name}")

            headers = {
                "Authorization": f"Bearer {MISTRAL_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2048
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.mistral.ai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                )
                
            if response.status_code != 200:
                raise Exception(f"Mistral API returned HTTP {response.status_code}: {response.text}")

            res_data = response.json()
            reply = res_data["choices"][0]["message"]["content"]
            
            usage = None
            if "usage" in res_data:
                usage = {
                    "prompt_tokens": res_data["usage"]["prompt_tokens"],
                    "completion_tokens": res_data["usage"]["completion_tokens"],
                    "total_tokens": res_data["usage"]["total_tokens"],
                }

            # Process action tags for Penny (Google Calendar/Gmail)
            reply = await _process_employee_actions(emp["name"], reply, messages)

            return {
                "reply": reply,
                "employee_name": emp["name"],
                "employee_role": emp["role"],
                "usage": usage,
            }

        except Exception as e:
            logger.error(f"Mistral API error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Mistral API error: {str(e)}",
            )
            
    else:
        # Standard Groq API path
        client = _get_groq(http_request)

        try:
            system_prompt = get_employee_personality_from_file(emp["name"]) or emp["system_prompt"]
            employee_memory = get_employee_memory_from_file(emp["name"]) or emp["memory"] or ""

            messages = [{"role": "system", "content": system_prompt}]

            # Inject employee's personal memory as context
            if employee_memory and len(employee_memory) > 20:
                messages.append({
                    "role": "system",
                    "content": f"[MY PERSONAL MEMORY — what I remember]:\n{employee_memory}",
                })

            if req.conversation_history:
                messages.extend(
                    [{"role": m.role, "content": m.content} for m in req.conversation_history]
                )

            messages.append({"role": "user", "content": req.message})

            # Intercept todo intents BEFORE sending to LLM
            todo_result = _handle_todo_intents(req.message)
            if todo_result:
                system_context = {
                    "role": "system",
                    "content": f"[TODO OPERATION EXECUTED]: {todo_result['result_text']}\n\nUse this information to respond to the CEO. Don't make up any other todo items - this is what actually happened."
                }
                messages.insert(-1, system_context)
                logger.info(f"📋 Todo intent handled: {todo_result['action']}")

            logger.info(f"Company chat with {emp['name']} using Groq model: {emp['model']}")

            completion = client.chat.completions.create(
                messages=messages,
                model=emp["model"],
                temperature=0.7,
                max_tokens=2048,
            )

            reply = completion.choices[0].message.content
            usage = {
                "prompt_tokens": completion.usage.prompt_tokens,
                "completion_tokens": completion.usage.completion_tokens,
                "total_tokens": completion.usage.total_tokens,
            } if completion.usage else None

            return {
                "reply": reply,
                "employee_name": emp["name"],
                "employee_role": emp["role"],
                "usage": usage,
            }

        except Exception as e:
            logger.error(f"Groq employee chat error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error chatting with {emp['name']}: {str(e)}",
            )


@app.post("/api/company/group-chat", response_model=GroupChatResponse)
async def group_chat(req: GroupChatRequest, http_request: Request):
    """Group chat — routes message to the right employee(s).
    
    - Default primary is Harry (manager)
    - @mention overrides: @david, @penny, @harry
    - Responses with [DELEGATE: employee="X" task="Y"] are routed further
    """
    conn = get_db()
    employees = {
        r["name"].lower(): dict(r)
        for r in conn.execute(
            "SELECT id, name, model, role, system_prompt, memory, avatar_color FROM company_employees"
        ).fetchall()
    }
    conn.close()

    interactions = []
    message = req.message.strip()

    if not employees:
        raise HTTPException(status_code=503, detail="No employees in the company")

    # Determine primary target from @mentions
    target_name = None
    for name in employees:
        at_mention = f"@{name.lower()}"
        if at_mention in message.lower():
            target_name = name
            break
    
    # Default to Harry
    if not target_name:
        target_name = "harry" if "harry" in employees else list(employees.keys())[0]
    
    # Normalize case to match employee dict keys
    target_key = target_name.lower()
    target = employees.get(target_key)
    if not target:
        target = list(employees.values())[0]

    async def chat_with_emp(employee: dict, msg: str, is_delegation: bool = False) -> str:
        """Helper: chat with one employee and return their reply."""
        system_prompt = get_employee_personality_from_file(employee["name"]) or employee["system_prompt"]
        employee_memory = get_employee_memory_from_file(employee["name"]) or employee.get("memory") or ""

        msgs = [{"role": "system", "content": system_prompt}]
        if employee_memory and len(employee_memory) > 20:
            msgs.append({"role": "system", "content": f"[MY PERSONAL MEMORY]:\n{employee_memory}"})

        if req.conversation_history and not is_delegation:
            for m in req.conversation_history:
                if m.role in ("user", "harry", "penny", "david"):
                    msgs.append({"role": "user" if m.role == "user" else "system", "content": m.content})

        msgs.append({"role": "user", "content": msg})

        model_name = employee["model"]

        try:
            if "/" in model_name:
                headers = {
                    "Authorization": f"Bearer {OPEN_ROUTER_API_KEY}",
                    "Content-Type": "application/json",
                }
                payload = {"model": model_name, "messages": msgs, "temperature": 0.7, "max_tokens": 4096}
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=120
                    )
                if resp.status_code != 200:
                    raise Exception(f"OpenRouter API returned HTTP {resp.status_code}: {resp.text}")
                reply = resp.json()["choices"][0]["message"]["content"]

            elif model_name.startswith("mistral-") or "open-mixtral" in model_name:
                headers = {"Authorization": f"Bearer {MISTRAL_API_KEY}", "Content-Type": "application/json"}
                payload = {"model": model_name, "messages": msgs, "temperature": 0.7, "max_tokens": 2048}
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://api.mistral.ai/v1/chat/completions", headers=headers, json=payload, timeout=60
                    )
                if resp.status_code != 200:
                    raise Exception(f"Mistral API returned HTTP {resp.status_code}: {resp.text}")
                reply = resp.json()["choices"][0]["message"]["content"]

            else:
                groq_client = _get_groq(http_request)
                completion = groq_client.chat.completions.create(
                    messages=msgs, model=model_name, temperature=0.7, max_tokens=2048
                )
                reply = completion.choices[0].message.content

            return reply
        except Exception as e:
            logger.error(f"Group chat error for {employee['name']}: {e}", exc_info=True)
            return f"[Error: {employee['name']} could not respond — {str(e)}]"

    # Step 1: Primary response
    primary_reply = await chat_with_emp(target, message, is_delegation=False)

    interactions.append(GroupInteraction(
        from_name=target["name"],
        from_id=target["id"],
        from_role=target["role"],
        to_name="CEO",
        message=primary_reply,
        type="response",
    ))

    # Step 2: Process delegation tags in the primary response
    delegation_pattern = re.compile(r'\[DELEGATE:\s*employee="([^"]+)"\s*task="([^"]*)"\]', re.IGNORECASE)
    for match in delegation_pattern.finditer(primary_reply):
        delegate_name = match.group(1).strip()
        delegate_task = match.group(2).strip()
        delegate_key = delegate_name.lower()

        if delegate_key in employees:
            delegate = employees[delegate_key]
            # Add delegation interaction
            interactions.append(GroupInteraction(
                from_name=target["name"],
                from_id=target["id"],
                from_role=target["role"],
                to_name=delegate["name"],
                message=delegate_task,
                type="delegation",
            ))
            # Get response from delegate
            delegate_reply = await chat_with_emp(delegate, delegate_task, is_delegation=True)
            interactions.append(GroupInteraction(
                from_name=delegate["name"],
                from_id=delegate["id"],
                from_role=delegate["role"],
                to_name="CEO",
                message=delegate_reply,
                type="response",
            ))

    return GroupChatResponse(interactions=interactions)


# ===== Memory Endpoints =====

@app.get("/api/memory")
async def api_get_memory():
    """Get the current memory.md content."""
    return {"memory": get_memory()}


class MemoryRequest(BaseModel):
    content: str


@app.put("/api/memory")
async def api_update_memory(req: MemoryRequest):
    """Update memory.md with new content."""
    set_memory(req.content)
    logger.info("Memory updated")
    return {"status": "ok"}


@app.post("/api/memory/append")
async def api_append_memory(req: MemoryRequest):
    """Append content to memory.md."""
    current = get_memory()
    new_content = current + "\n\n" + req.content if current else req.content
    set_memory(new_content)
    logger.info("Memory appended")
    return {"status": "ok"}


@app.get("/api/models")
async def list_models():
    """Return a curated list of available models (Groq + Mistral)."""
    return {
        "models": [
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "description": "Latest versatile model (Groq)"},
            {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "description": "Great all-rounder, 32K context (Groq)"},
            {"id": "mistral-large-latest", "name": "Mistral Large", "description": "Top-tier Reasoning & Agency (Mistral API)"},
            {"id": "mistral-small-latest", "name": "Mistral Small", "description": "Fast and lightweight assistant (Mistral API)"},
            {"id": "gemma2-9b-it", "name": "Gemma 2 9B", "description": "Google Gemma 2 (Groq)"},
            {"id": "nvidia/nemotron-3-super-120b-a12b:free", "name": "Nemotron 3 Super 120B", "description": "1M context, free (OpenRouter)"},
        ]
    }


# ===== Google Services Endpoints =====

@app.get("/api/google/auth-url")
async def google_auth_url():
    """Get the Google OAuth2 authorization URL for the user to visit."""
    try:
        auth_url = google_service.get_authorization_url()
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/auth/google/callback")
async def google_callback(request: Request):
    """Handle the OAuth2 callback from Google."""
    try:
        google_service.handle_callback(str(request.url))
        logger.info("✅ Google OAuth2 authentication successful")
        # Close popup window with success message
        return HTMLResponse(
            "<html><body><script>window.close();</script><p>Authentication successful! You can close this window.</p></body></html>"
        )
    except Exception as e:
        logger.error(f"Google OAuth callback error: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")


@app.get("/api/google/status")
async def google_status():
    """Check if the user is connected to Google."""
    connected = google_service.is_connected()
    return {
        "connected": connected,
        "configured": bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET")),
        "message": "Connected to Google" if connected
        else ("Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
             if not os.getenv("GOOGLE_CLIENT_ID") else "Not authenticated. Visit /api/google/auth-url to connect."),
    }


@app.post("/api/google/disconnect")
async def google_disconnect():
    """Disconnect Google account and remove stored credentials."""
    google_service.disconnect()
    return {"status": "ok", "message": "Google account disconnected."}


@app.get("/api/google/calendar/events")
async def list_calendar_events(max_results: int = 10):
    """List upcoming calendar events."""
    try:
        events = google_service.list_calendar_events(max_results=max_results)
        return {"events": events}
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calendar error: {str(e)}")


class CalendarEventRequest(BaseModel):
    summary: str
    start_time: str
    end_time: str
    description: str = ""
    location: str = ""
    attendees: list = None


@app.post("/api/google/calendar/events")
async def create_calendar_event(req: CalendarEventRequest):
    """Create a new calendar event."""
    try:
        event = google_service.create_calendar_event(
            summary=req.summary,
            start_time=req.start_time,
            end_time=req.end_time,
            description=req.description,
            location=req.location,
            attendees=req.attendees or [],
        )
        return {"event": event}
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calendar error: {str(e)}")


@app.get("/api/google/gmail/inbox")
async def list_gmail_inbox(max_results: int = 10):
    """List recent emails from inbox."""
    try:
        messages = google_service.list_gmail_messages(max_results=max_results)
        return {"messages": messages}
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail error: {str(e)}")


class GmailSendRequest(BaseModel):
    to: str
    subject: str
    body: str
    cc: str = None
    bcc: str = None


@app.post("/api/google/gmail/send")
async def send_gmail(req: GmailSendRequest):
    """Send an email via Gmail."""
    try:
        result = google_service.send_gmail_message(
            to=req.to,
            subject=req.subject,
            body=req.body,
            cc=req.cc,
            bcc=req.bcc,
        )
        return {"message": result}
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail error: {str(e)}")


@app.get("/api/google/gmail/message/{message_id}")
async def get_gmail_message(message_id: str):
    """Get the full content of a specific email."""
    try:
        msg = google_service.get_gmail_message(message_id)
        return {"message": msg}
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail error: {str(e)}")


# ===== Todo Endpoints =====

class TodoCreate(BaseModel):
    text: str


@app.get("/api/todos")
async def list_todos(filter: str = ""):
    """List todos. Use filter=active for incomplete, completed for done, or empty for all."""
    conn = get_db()
    if filter == "active":
        rows = conn.execute(
            "SELECT id, text, completed, created_at FROM todos WHERE completed=0 ORDER BY created_at DESC"
        ).fetchall()
    elif filter == "completed":
        rows = conn.execute(
            "SELECT id, text, completed, created_at FROM todos WHERE completed=1 ORDER BY created_at DESC"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, text, completed, created_at FROM todos ORDER BY completed ASC, created_at DESC"
        ).fetchall()
    conn.close()
    return {"todos": [dict(r) for r in rows]}


@app.post("/api/todos")
async def create_todo(req: TodoCreate):
    """Add a new todo item."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Todo text cannot be empty")
    conn = get_db()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO todos (text, completed, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (req.text.strip(), 0, now, now),
    )
    conn.commit()
    todo_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    todo = conn.execute("SELECT id, text, completed, created_at FROM todos WHERE id=?", (todo_id,)).fetchone()
    conn.close()
    return dict(todo)


@app.put("/api/todos/{todo_id}/toggle")
async def toggle_todo(todo_id: int):
    """Toggle a todo's completed status."""
    conn = get_db()
    todo = conn.execute("SELECT id, completed FROM todos WHERE id=?", (todo_id,)).fetchone()
    if not todo:
        conn.close()
        raise HTTPException(status_code=404, detail="Todo not found")
    now = datetime.now(timezone.utc).isoformat()
    new_val = 0 if todo["completed"] else 1
    conn.execute("UPDATE todos SET completed=?, updated_at=? WHERE id=?", (new_val, now, todo_id))
    conn.commit()
    conn.close()
    return {"id": todo_id, "completed": bool(new_val)}


@app.put("/api/todos/{todo_id}")
async def update_todo(todo_id: int, req: TodoCreate):
    """Update a todo's text."""
    conn = get_db()
    todo = conn.execute("SELECT id FROM todos WHERE id=?", (todo_id,)).fetchone()
    if not todo:
        conn.close()
        raise HTTPException(status_code=404, detail="Todo not found")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("UPDATE todos SET text=?, updated_at=? WHERE id=?", (req.text.strip(), now, todo_id))
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: int):
    """Delete a todo item."""
    conn = get_db()
    conn.execute("DELETE FROM todos WHERE id=?", (todo_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


# --- Run ---
if __name__ == "__main__":
    import uvicorn

    ssl_cert = os.getenv("SSL_CERT")
    ssl_key = os.getenv("SSL_KEY")

    ssl_kwargs = {}
    if ssl_cert and ssl_key and os.path.exists(ssl_cert) and os.path.exists(ssl_key):
        ssl_kwargs["ssl_certfile"] = ssl_cert
        ssl_kwargs["ssl_keyfile"] = ssl_key
        logger.info(f"HTTPS enabled (cert={ssl_cert})")

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, **ssl_kwargs)
