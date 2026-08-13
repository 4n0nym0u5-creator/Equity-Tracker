#!/usr/bin/env python3
"""
Local server for the NDQ.AX Pulse dashboard.

  - Serves the static site (index.html, css/, js/, vendor/, data/) on http://127.0.0.1:8420
  - Serves JS/HTML/JSON with no-cache headers so the in-app Refresh button always
    picks up freshly-scraped data.
  - POST /api/refresh  ->  re-runs fetch_data.py (Yahoo Finance + AustralianSuper)
                            and returns { ok, durationSec, log }.

Run:  .venv/bin/python serve.py
"""
import json
import os
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
PORT = 8420
NO_CACHE = (".html", ".js", ".json")


class Handler(SimpleHTTPRequestHandler):
    # silence default noisy logging
    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        if self.path.endswith(NO_CACHE):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    # ---- refresh endpoint -------------------------------------------------
    def _do_refresh(self):
        t0 = time.time()
        try:
            proc = subprocess.run(
                [sys.executable, str(ROOT / "fetch_data.py")],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=240,
            )
            log = (proc.stdout or "") + (proc.stderr or "")
            tail = "\n".join(log.splitlines()[-40:])
            body = {
                "ok": proc.returncode == 0,
                "durationSec": round(time.time() - t0, 1),
                "log": tail,
            }
            self._json(200 if proc.returncode == 0 else 500, body)
        except subprocess.TimeoutExpired:
            self._json(504, {"ok": False, "durationSec": round(time.time() - t0, 1),
                             "log": "fetch_data.py timed out (>240s)."})
        except Exception as e:
            self._json(500, {"ok": False, "durationSec": round(time.time() - t0, 1),
                             "log": f"server error: {e}"})

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path.rstrip("/") == "/api/refresh":
            self._do_refresh()
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path.rstrip("/") == "/api/refresh":
            self._do_refresh()
        else:
            super().do_GET()


def main():
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        print(f"Could not bind 127.0.0.1:{PORT} — {e}")
        print("Tip: stop any other server on that port, or edit PORT in serve.py.")
        sys.exit(1)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"NDQ.AX Pulse running on  {url}")
    print("Refresh button (top-right) re-runs fetch_data.py via POST /api/refresh")
    print("Ctrl-C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
