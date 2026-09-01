"""A small local OA SSO simulator for Middle Platform.

It issues a one-time ticket and redirects the browser to the portal login page.
The portal calls POST /api/tickets/verify to exchange that ticket for a user.
"""

from __future__ import annotations

import html
import os
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit

from flask import Flask, Response, jsonify, redirect, request

app = Flask(__name__)

DEFAULT_TARGET_URL = "http://localhost:8088/login?ssoCode=mock_oa"
TICKET_TTL_SECONDS = int(os.getenv("SSO_TICKET_TTL_SECONDS", "10"))
TARGET_URL = os.getenv("SSO_TARGET_URL", DEFAULT_TARGET_URL)


@dataclass(frozen=True)
class TicketIdentity:
    user_id: str
    name: str
    expires_at: float


_tickets: dict[str, TicketIdentity] = {}
_ticket_lock = threading.Lock()


def configured_users() -> dict[str, str]:
    """Read mock users from SSO_USERS, for example: admin:Admin,alice:Alice."""
    value = os.getenv("SSO_USERS", "admin:Admin,demo:Demo,other:Other")
    users: dict[str, str] = {}
    for item in value.split(","):
        user_id, separator, name = item.strip().partition(":")
        if user_id:
            users[user_id] = name.strip() if separator and name.strip() else user_id
    return users or {"admin": "Admin"}


def issue_ticket(user_id: str, name: str) -> str:
    ticket = secrets.token_urlsafe(32)
    identity = TicketIdentity(user_id=user_id, name=name, expires_at=time.time() + TICKET_TTL_SECONDS)
    with _ticket_lock:
        _tickets[ticket] = identity
    return ticket


def consume_ticket(ticket: str) -> TicketIdentity | None:
    with _ticket_lock:
        identity = _tickets.pop(ticket, None)
    if not identity or identity.expires_at < time.time():
        return None
    return identity


def append_ticket(target_url: str, ticket: str) -> str:
    """Append the ticket while preserving any configured query parameters."""
    target = urlsplit(target_url)
    query = f"{target.query}&" if target.query else ""
    query += urlencode({"ticket": ticket})
    return urlunsplit((target.scheme, target.netloc, target.path, query, target.fragment))


@app.after_request
def prevent_ticket_caching(response: Response) -> Response:
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def index() -> Response:
    options = "".join(
        f'<option value="{html.escape(user_id)}">{html.escape(name)} ({html.escape(user_id)})</option>'
        for user_id, name in configured_users().items()
    )
    content = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>模拟 OA SSO</title>
<style>body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:48px;background:#f5f7fa;color:#172033}}main{{max-width:520px;background:#fff;padding:32px;border:1px solid #d9e1eb;border-radius:8px}}label,select,button{{display:block;width:100%;box-sizing:border-box}}label{{margin:20px 0 8px}}select,button{{padding:10px;font-size:15px}}button{{margin-top:24px;background:#1677ff;color:#fff;border:0;border-radius:4px;cursor:pointer}}code{{word-break:break-all}}</style>
</head><body><main><h1>模拟 OA 单点登录</h1><p>选择本地用户后，将签发一次性 ticket 并跳转至 AI 财务助手。</p>
<form method="post" action="/sso/login"><label for="user_id">用户</label><select id="user_id" name="user_id">{options}</select><button type="submit">发起单点登录</button></form>
<p>目标地址：<code>{html.escape(TARGET_URL)}</code></p><p>Ticket 有效期：{TICKET_TTL_SECONDS} 秒，验证后立即失效。</p></main></body></html>"""
    return Response(content, content_type="text/html; charset=utf-8")


@app.post("/sso/login")
def sso_login() -> Response:
    users = configured_users()
    user_id = str(request.form.get("user_id", "")).strip()
    if user_id not in users:
        return jsonify(message="模拟用户不存在"), 400
    ticket = issue_ticket(user_id, users[user_id])
    return redirect(append_ticket(TARGET_URL, ticket), code=302)


@app.post("/api/tickets/verify")
def verify_ticket() -> tuple[Response, int] | Response:
    payload: dict[str, Any] = request.get_json(silent=True) or {}
    ticket = str(payload.get("ticket", "")).strip()
    identity = consume_ticket(ticket) if ticket else None
    if not identity:
        return jsonify(message="ticket 无效、已过期或已使用"), 401
    return jsonify(userId=identity.user_id, name=identity.name)


@app.get("/api/health")
def health() -> Response:
    return jsonify(status="ok", ticketTtlSeconds=TICKET_TTL_SECONDS)


if __name__ == "__main__":
    host = os.getenv("SSO_HOST", "0.0.0.0")
    port = int(os.getenv("SSO_PORT", "9000"))
    app.run(host=host, port=port, debug=os.getenv("SSO_DEBUG") == "true")
