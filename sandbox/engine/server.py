from __future__ import annotations

import json
import mimetypes
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .repository import ROOT, Repository
from .workflow import WorkflowService


WEB_DIR = ROOT / "web"
HOST = "127.0.0.1"
PORT = 8765
REPOSITORY = Repository()
WORKFLOW = WorkflowService(REPOSITORY)


class Handler(BaseHTTPRequestHandler):
    server_version = "DecisionEngineSandbox/0.1"

    def log_message(self, format_string: str, *args: object) -> None:
        sys.stdout.write("[sandbox] " + (format_string % args) + "\n")

    def _json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/bootstrap":
            self._json(REPOSITORY.bootstrap())
            return
        if parsed.path == "/api/health":
            self._json({"ok": True, "service": "Decision Engine Offline Research Workbench"})
            return
        self._serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        payload = self._read_json()
        actor = payload.get("actor", "Grace Cui")
        parts = [part for part in parsed.path.split("/") if part]
        try:
            if parsed.path == "/api/reset":
                self._json({"ok": True, "state": REPOSITORY.reset_state()})
                return
            if parsed.path == "/api/llm/suggest":
                self._json(WORKFLOW.llm_suggestion(payload.get("object_id", "TR02"), payload.get("step_id", "T04")))
                return
            if parsed.path == "/api/llm/accept":
                self._json(WORKFLOW.accept_llm_patch(payload, actor))
                return
            if parsed.path == "/api/objects":
                self._json(WORKFLOW.create_object(payload, actor))
                return
            if len(parts) == 4 and parts[:2] == ["api", "objects"] and parts[3] == "draft":
                self._json(WORKFLOW.save_draft(parts[2], payload.get("step_id", "T01"), payload.get("patch", {}), actor))
                return
            if len(parts) == 4 and parts[:2] == ["api", "objects"] and parts[3] == "run":
                result = WORKFLOW.run_object(parts[2], actor, payload.get("parent_run"))
                self._json(result, 200 if result.get("ok") else 400)
                return
            if len(parts) == 3 and parts[:2] == ["api", "reviews"]:
                result = WORKFLOW.review(parts[2], payload.get("decision", "REQUEST_CHANGES"), payload.get("comment", ""), actor)
                self._json(result, 200 if result.get("ok") else 404)
                return
            if len(parts) == 4 and parts[:2] == ["api", "runs"] and parts[3] == "replay":
                result = WORKFLOW.run_object("TR02", actor, parts[2])
                self._json(result, 200 if result.get("ok") else 400)
                return
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self._json({"ok": False, "error": str(error)}, 400)
            return
        self._json({"ok": False, "error": "Unknown API endpoint"}, 404)

    def _serve_static(self, request_path: str) -> None:
        relative = request_path.lstrip("/") or "index.html"
        candidate = (WEB_DIR / relative).resolve()
        try:
            candidate.relative_to(WEB_DIR.resolve())
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if not candidate.is_file():
            candidate = WEB_DIR / "index.html"
        content = candidate.read_bytes()
        content_type, _ = mimetypes.guess_type(str(candidate))
        self.send_response(200)
        self.send_header("Content-Type", (content_type or "application/octet-stream") + ("; charset=utf-8" if candidate.suffix in {".html", ".css", ".js"} else ""))
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Decision Engine Offline Research Workbench running at http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Decision Engine Sandbox.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

