"""Lightweight target system for the Middle Platform outbound Ticket SSO demo."""

import html
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Flask, Response, redirect, request, session, url_for


app = Flask(__name__)
app.secret_key = os.getenv("TARGET_SESSION_SECRET", "mock-target-session-secret-change-me")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)

SSO_CODE = os.getenv("SSO_CODE", "mock_target")
VERIFY_URL = os.getenv(
    "MIDDLE_PLATFORM_VERIFY_URL",
    f"http://localhost:8088/api/auth/sso/outbound/{SSO_CODE}/verify",
)
CLIENT_SECRET = os.getenv("TARGET_CLIENT_SECRET", "mock-target-secret-2026")
VERIFY_TIMEOUT_SECONDS = float(os.getenv("SSO_VERIFY_TIMEOUT_SECONDS", "5"))


def verify_ticket(ticket: str) -> dict:
    payload = json.dumps({"ticket": ticket}).encode("utf-8")
    verify_request = Request(
        VERIFY_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {CLIENT_SECRET}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(verify_request, timeout=VERIFY_TIMEOUT_SECONDS) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            message = json.loads(error.read().decode("utf-8")).get("message")
        except (UnicodeDecodeError, json.JSONDecodeError):
            message = None
        raise ValueError(message or "Ticket 校验失败") from error
    except (URLError, TimeoutError) as error:
        raise ConnectionError("无法连接集成平台 Ticket 校验接口") from error


def page(content: str, status: int = 200) -> tuple[Response, int]:
    body = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>目标业务系统</title><style>
body{{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f6f8;color:#172033}}
main{{width:min(640px,calc(100% - 32px));margin:72px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;box-shadow:0 12px 30px rgba(15,23,42,.08)}}
h1{{margin:0 0 20px;font-size:24px}}dl{{display:grid;grid-template-columns:110px 1fr;gap:12px;margin:24px 0}}dt{{color:#64748b}}dd{{margin:0;font-weight:600;overflow-wrap:anywhere}}button{{border:0;border-radius:6px;padding:10px 16px;background:#1677ff;color:#fff;cursor:pointer}}.error{{color:#b42318}}
</style></head><body><main><h1>目标业务系统</h1>{content}</main></body></html>"""
    return Response(body, content_type="text/html; charset=utf-8"), status


@app.get("/")
def home() -> tuple[Response, int]:
    identity = session.get("user")
    if not identity:
        return page("<p>当前没有目标系统会话，请从集成平台工作台发起 Ticket 单点登录。</p>")
    rows = "".join(
        f"<dt>{html.escape(str(key))}</dt><dd>{html.escape(str(value))}</dd>"
        for key, value in identity.items()
        if not isinstance(value, (dict, list))
    )
    return page(f"<p>Ticket 已核销，目标系统会话建立成功。</p><dl>{rows}</dl><form method='post' action='/logout'><button type='submit'>退出目标系统</button></form>")


@app.get("/sso/login")
def sso_login() -> Response | tuple[Response, int]:
    ticket = request.args.get("ticket", "").strip()
    code = request.args.get("ssoCode", "").strip()
    if not ticket or code != SSO_CODE:
        return page("<p class='error'>缺少 Ticket 或 SSO 编码不匹配。</p>", 400)
    try:
        identity = verify_ticket(ticket)
    except (ValueError, ConnectionError) as error:
        session.pop("user", None)
        return page(f"<p class='error'>{html.escape(str(error))}</p>", 401)
    session.clear()
    session["user"] = identity
    return redirect(url_for("home"), code=302)


@app.post("/logout")
def logout() -> Response:
    session.clear()
    return redirect(url_for("home"), code=302)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "ssoCode": SSO_CODE}


if __name__ == "__main__":
    app.run(
        host=os.getenv("TARGET_HOST", "0.0.0.0"),
        port=int(os.getenv("TARGET_PORT", "9100")),
        debug=os.getenv("TARGET_DEBUG") == "true",
    )
