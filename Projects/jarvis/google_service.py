"""
Google Services — OAuth2 for Calendar & Gmail API integration.

Provides:
  - OAuth2 authorization flow (web server app)
  - Google Calendar API (list events, create events)
  - Gmail API (list inbox, send email)
  - Credential storage in SQLite DB

Environment variables required:
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_REDIRECT_URI  (e.g. http://localhost:8000/auth/google/callback)
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import sqlite3

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger("spectre.google")

# --- Scopes ---
# Full access to Calendar events + Gmail send/read
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

DB_PATH = "jarvis.db"
USER_ID = "ceo"  # single-user app — just one CEO


# ===== Database Helpers =====

def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_google_table():
    """Create the google_credentials table if it doesn't exist."""
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS google_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            credentials_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def _save_credentials(creds: Credentials):
    """Serialize and store credentials for the CEO user."""
    conn = _get_db()
    now = datetime.now(timezone.utc).isoformat()
    serialized = creds.to_json()
    existing = conn.execute(
        "SELECT id FROM google_credentials WHERE user_id=?", (USER_ID,)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE google_credentials SET credentials_json=?, updated_at=? WHERE user_id=?",
            (serialized, now, USER_ID),
        )
    else:
        conn.execute(
            "INSERT INTO google_credentials (user_id, credentials_json, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (USER_ID, serialized, now, now),
        )
    conn.commit()
    conn.close()


def _load_credentials() -> Optional[Credentials]:
    """Load stored credentials for the CEO user. Returns None if not found."""
    conn = _get_db()
    row = conn.execute(
        "SELECT credentials_json FROM google_credentials WHERE user_id=?",
        (USER_ID,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    try:
        creds = Credentials.from_authorized_user_info(json.loads(row["credentials_json"]), SCOPES)
        return creds
    except Exception as e:
        logger.error(f"Failed to load credentials: {e}")
        return None


# ===== OAuth2 Flow =====

def get_authorization_url() -> str:
    """Build and return the Google OAuth2 authorization URL."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not all([client_id, client_secret, redirect_uri]):
        raise ValueError(
            "Missing Google OAuth environment variables. "
            "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env"
        )

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }

    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # Force refresh token on first auth
    )
    return auth_url


def handle_callback(authorization_response: str) -> Credentials:
    """Handle the OAuth2 callback, exchange code for tokens, and store credentials."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not all([client_id, client_secret, redirect_uri]):
        raise ValueError("Missing Google OAuth environment variables.")

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }

    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri
    flow.fetch_token(authorization_response=authorization_response)

    creds = flow.credentials
    _save_credentials(creds)
    logger.info("✅ Google OAuth2 credentials saved successfully")
    return creds


def get_credentials() -> Optional[Credentials]:
    """Get valid credentials, refreshing if expired."""
    creds = _load_credentials()
    if not creds:
        return None

    # Refresh if expired
    if creds.expired:
        if not creds.refresh_token:
            # No refresh token — user needs to re-authenticate
            logger.warning("Google credentials expired with no refresh token — removing stored creds.")
            disconnect()
            return None
        try:
            creds.refresh(GoogleRequest())
            _save_credentials(creds)
            logger.info("🔄 Google credentials refreshed")
        except Exception as e:
            logger.error(f"Failed to refresh Google credentials: {e}")
            disconnect()
            return None

    return creds


def is_connected() -> bool:
    """Check if CEO has valid Google credentials stored."""
    creds = get_credentials()
    return creds is not None and creds.valid


def disconnect():
    """Remove stored Google credentials."""
    conn = _get_db()
    conn.execute("DELETE FROM google_credentials WHERE user_id=?", (USER_ID,))
    conn.commit()
    conn.close()
    logger.info("🔌 Google credentials removed")


# ===== Calendar API =====

def list_calendar_events(max_results: int = 10) -> list:
    """List upcoming events from the user's primary calendar."""
    creds = get_credentials()
    if not creds:
        raise PermissionError("Not connected to Google. Please authenticate.")

    try:
        service = build("calendar", "v3", credentials=creds)
        now = datetime.now(timezone.utc).isoformat() + "Z"

        events_result = service.events().list(
            calendarId="primary",
            timeMin=now,
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        events = events_result.get("items", [])
        result = []
        for event in events:
            start = event["start"].get("dateTime", event["start"].get("date"))
            end = event["end"].get("dateTime", event["end"].get("date"))
            result.append({
                "id": event["id"],
                "summary": event.get("summary", "(No title)"),
                "description": event.get("description", ""),
                "start": start,
                "end": end,
                "location": event.get("location", ""),
                "attendees": [
                    {"email": a.get("email"), "name": a.get("displayName", "")}
                    for a in event.get("attendees", [])
                ],
            })
        return result

    except HttpError as e:
        logger.error(f"Calendar API error: {e}")
        raise


def create_calendar_event(
    summary: str,
    start_time: str,
    end_time: str,
    description: str = "",
    location: str = "",
    attendees: list = None,
) -> dict:
    """Create a new event on the user's primary calendar.

    Args:
        summary: Event title
        start_time: ISO 8601 datetime string (e.g. 2025-07-01T14:00:00)
        end_time: ISO 8601 datetime string
        description: Optional description
        location: Optional location
        attendees: List of {"email": str} dicts

    Returns:
        The created event object.
    """
    creds = get_credentials()
    if not creds:
        raise PermissionError("Not connected to Google. Please authenticate.")

    try:
        service = build("calendar", "v3", credentials=creds)

        event_body = {
            "summary": summary,
            "description": description,
            "location": location,
            "start": {
                "dateTime": start_time,
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_time,
                "timeZone": "UTC",
            },
        }

        if attendees:
            event_body["attendees"] = attendees

        event = service.events().insert(
            calendarId="primary",
            body=event_body,
            sendUpdates="all" if attendees else "none",
        ).execute()

        logger.info(f"📅 Event created: {summary} ({event.get('htmlLink', '')})")
        return {
            "id": event["id"],
            "summary": event.get("summary"),
            "start": event["start"].get("dateTime", event["start"].get("date")),
            "end": event["end"].get("dateTime", event["end"].get("date")),
            "htmlLink": event.get("htmlLink", ""),
        }

    except HttpError as e:
        logger.error(f"Calendar API error: {e}")
        raise


# ===== Gmail API =====

def list_gmail_messages(max_results: int = 10) -> list:
    """List recent email messages from the user's inbox."""
    creds = get_credentials()
    if not creds:
        raise PermissionError("Not connected to Google. Please authenticate.")

    try:
        service = build("gmail", "v1", credentials=creds)

        results = service.users().messages().list(
            userId="me",
            maxResults=max_results,
            labelIds=["INBOX"],
            q="in:inbox",
        ).execute()

        messages = results.get("messages", [])
        result = []

        for msg_meta in messages:
            msg = service.users().messages().get(
                userId="me", id=msg_meta["id"], format="metadata",
                metadataHeaders=["From", "To", "Subject", "Date"],
            ).execute()

            headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
            result.append({
                "id": msg["id"],
                "threadId": msg.get("threadId", ""),
                "from": headers.get("From", ""),
                "to": headers.get("To", ""),
                "subject": headers.get("Subject", "(No subject)"),
                "date": headers.get("Date", ""),
                "snippet": msg.get("snippet", ""),
                "labelIds": msg.get("labelIds", []),
            })

        return result

    except HttpError as e:
        logger.error(f"Gmail API error: {e}")
        raise


def send_gmail_message(to: str, subject: str, body: str, cc: str = None, bcc: str = None) -> dict:
    """Send an email via Gmail API.

    Args:
        to: Recipient email address
        subject: Email subject
        body: Plain text email body
        cc: Optional CC recipient
        bcc: Optional BCC recipient

    Returns:
        The sent message info.
    """
    import base64
    from email.mime.text import MIMEText

    creds = get_credentials()
    if not creds:
        raise PermissionError("Not connected to Google. Please authenticate.")

    try:
        service = build("gmail", "v1", credentials=creds)

        message = MIMEText(body)
        message["To"] = to
        message["Subject"] = subject
        if cc:
            message["Cc"] = cc

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        sent = service.users().messages().send(
            userId="me",
            body={"raw": raw},
        ).execute()

        logger.info(f"📧 Email sent to {to}: {subject}")
        return {
            "id": sent["id"],
            "threadId": sent.get("threadId", ""),
            "to": to,
            "subject": subject,
        }

    except HttpError as e:
        logger.error(f"Gmail API error: {e}")
        raise


def get_gmail_message(message_id: str) -> dict:
    """Get the full content of a specific email."""
    creds = get_credentials()
    if not creds:
        raise PermissionError("Not connected to Google. Please authenticate.")

    try:
        service = build("gmail", "v1", credentials=creds)

        msg = service.users().messages().get(
            userId="me", id=message_id, format="full",
        ).execute()

        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}

        # Extract body
        body = ""
        payload = msg.get("payload", {})
        if "parts" in payload:
            for part in payload["parts"]:
                if part.get("mimeType") == "text/plain" and "data" in part.get("body", {}):
                    import base64
                    body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                    break
        elif "body" in payload and "data" in payload["body"]:
            import base64
            body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

        return {
            "id": msg["id"],
            "threadId": msg.get("threadId", ""),
            "from": headers.get("From", ""),
            "to": headers.get("To", ""),
            "subject": headers.get("Subject", "(No subject)"),
            "date": headers.get("Date", ""),
            "body": body,
            "snippet": msg.get("snippet", ""),
            "labelIds": msg.get("labelIds", []),
        }

    except HttpError as e:
        logger.error(f"Gmail API error: {e}")
        raise
