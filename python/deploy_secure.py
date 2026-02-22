#!/usr/bin/env python3
"""
Secure local deploy orchestrator for Password Manager Pro.

Capabilities:
- Build frontend dist via npm
- Versioned deploy releases with integrity manifest
- Local HTTPS for frontend + HTTP->HTTPS redirect
- Optional local HTTPS API startup (Node server/index.js)
- Reverse proxy /api/* from frontend to API
- Watch mode: rebuild + hot-swap release automatically
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import http.client
import http.server
import ipaddress
import json
import os
import shutil
import signal
import socketserver
import ssl
import subprocess
import sys
import threading
import time
import urllib.parse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PY_DIR = ROOT / "python"
CERTS_DIR = PY_DIR / "certs"
RELEASES_DIR = PY_DIR / "releases"
STATE_DIR = PY_DIR / "state"
CURRENT_RELEASE_FILE = STATE_DIR / "current-release.json"
DEPLOY_HISTORY_FILE = STATE_DIR / "deploy-history.json"
DIST_DIR = ROOT / "dist"

DEFAULT_FRONTEND_HTTPS_PORT = 5443
DEFAULT_FRONTEND_HTTP_REDIRECT_PORT = 5080
DEFAULT_API_HTTPS_PORT = 4000


def info(msg: str) -> None:
    print(f"[python-deploy] {msg}")


def fail(msg: str, code: int = 1) -> None:
    print(f"[python-deploy][error] {msg}", file=sys.stderr)
    raise SystemExit(code)


def ensure_dirs() -> None:
    for directory in (CERTS_DIR, RELEASES_DIR, STATE_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def read_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def get_api_namespace() -> str:
    env = read_dotenv(ROOT / ".env")
    value = env.get("API_NAMESPACE")
    if value and len(value) >= 24:
        return value
    return "dev-local-vault-route-29af4c8e71b5"


def run_command(cmd: list[str], *, env: dict[str, str] | None = None) -> None:
    resolved = resolve_command(cmd)
    info(f"Running: {' '.join(cmd)}")
    try:
        proc = subprocess.run(resolved, cwd=str(ROOT), env=env)
    except FileNotFoundError:
        fail(f"No se encontro el ejecutable: {cmd[0]}. Verifica instalacion y PATH.")
    if proc.returncode != 0:
        fail(f"Command failed ({proc.returncode}): {' '.join(cmd)}")


def resolve_command(cmd: list[str]) -> list[str]:
    if not cmd:
        return cmd
    return [resolve_executable(cmd[0]), *cmd[1:]]


def resolve_executable(name: str) -> str:
    if os.name != "nt":
        return shutil.which(name) or name
    candidates = [name]
    if not Path(name).suffix:
        candidates.extend([f"{name}.exe", f"{name}.cmd", f"{name}.bat"])
    for candidate in candidates:
        found = shutil.which(candidate)
        if found:
            return found
    if name.lower() == "openssl":
        common = [
            r"C:\Program Files\Git\mingw64\bin\openssl.exe",
            r"C:\Program Files\Git\usr\bin\openssl.exe",
            r"C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
            r"C:\Program Files\OpenSSL-Win32\bin\openssl.exe",
        ]
        for path in common:
            if Path(path).exists():
                return path
    return name


def ensure_local_https_cert(cert_file: Path, key_file: Path) -> None:
    if cert_file.exists() and key_file.exists():
        return

    openssl_cmd = [
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-sha256",
        "-nodes",
        "-days",
        "825",
        "-keyout",
        str(key_file),
        "-out",
        str(cert_file),
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ]
    try:
        run_command(openssl_cmd)
    except SystemExit:
        if create_local_https_cert_python(cert_file, key_file):
            info("Certificado local generado con fallback Python (cryptography).")
            return
        fail(
            "No se pudo crear certificado local. Instala OpenSSL o 'pip install cryptography', o coloca manualmente:\n"
            f"- Certificado: {cert_file}\n"
            f"- Clave privada: {key_file}"
        )


def create_local_https_cert_python(cert_file: Path, key_file: Path) -> bool:
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
    except Exception:
        return False

    now = dt.datetime.now(dt.timezone.utc)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1))
        .not_valid_after(now + dt.timedelta(days=825))
        .add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
            ),
            critical=False,
        )
        .sign(private_key=key, algorithm=hashes.SHA256())
    )
    key_file.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_file.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return True


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def build_frontend() -> None:
    env = os.environ.copy()
    env["VITE_API_BASE"] = f"/api/v1/{get_api_namespace()}"
    run_command(["npm", "run", "build"], env=env)
    if not DIST_DIR.exists():
        fail("No existe dist/ luego de npm run build.")


def create_release() -> Path:
    now_utc = dt.datetime.now(dt.timezone.utc)
    release_name = now_utc.strftime("release-%Y%m%d-%H%M%S")
    release_dir = RELEASES_DIR / release_name
    info(f"Creating release {release_name}")
    shutil.copytree(DIST_DIR, release_dir / "dist", dirs_exist_ok=False)
    manifest = create_integrity_manifest(release_dir / "dist")
    (release_dir / "integrity.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    set_current_release(release_name)
    append_history(
        {
            "release": release_name,
            "createdAtUtc": now_utc.isoformat().replace("+00:00", "Z"),
            "files": len(manifest["files"]),
        }
    )
    return release_dir


def create_integrity_manifest(dist_path: Path) -> dict[str, object]:
    files = []
    for file in sorted(dist_path.rglob("*")):
        if not file.is_file():
            continue
        rel = file.relative_to(dist_path).as_posix()
        files.append(
            {
                "path": rel,
                "sha256": sha256_file(file),
                "bytes": file.stat().st_size,
            }
        )
    return {
        "algorithm": "sha256",
        "generatedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "files": files,
    }


def set_current_release(name: str) -> None:
    payload = {
        "release": name,
        "updatedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    CURRENT_RELEASE_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def get_current_release_dir() -> Path:
    if not CURRENT_RELEASE_FILE.exists():
        fail("No hay release activa. Ejecuta build/deploy primero.")
    data = json.loads(CURRENT_RELEASE_FILE.read_text(encoding="utf-8"))
    name = data.get("release")
    if not name:
        fail("current-release.json invalido.")
    path = RELEASES_DIR / str(name) / "dist"
    if not path.exists():
        fail(f"Release activa no encontrada: {path}")
    return path


def append_history(entry: dict[str, object]) -> None:
    data = []
    if DEPLOY_HISTORY_FILE.exists():
        try:
            data = json.loads(DEPLOY_HISTORY_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = []
    if not isinstance(data, list):
        data = []
    data.append(entry)
    DEPLOY_HISTORY_FILE.write_text(json.dumps(data[-100:], indent=2), encoding="utf-8")


def rollback_release(steps_back: int = 1) -> None:
    if steps_back < 1:
        fail("--steps debe ser >= 1")
    if not DEPLOY_HISTORY_FILE.exists():
        fail("No hay historial de deploys.")
    history = json.loads(DEPLOY_HISTORY_FILE.read_text(encoding="utf-8"))
    if not isinstance(history, list) or len(history) <= steps_back:
        fail("No hay suficientes releases para rollback.")
    target = history[-1 - steps_back]
    release_name = target.get("release")
    if not release_name or not (RELEASES_DIR / str(release_name)).exists():
        fail("Release objetivo invalida para rollback.")
    set_current_release(str(release_name))
    info(f"Rollback aplicado. Release activa: {release_name}")


def source_snapshot_hash() -> str:
    include_dirs = ["src", "server", "public"]
    include_files = ["package.json", "package-lock.json", "vite.config.js", ".env"]
    digest = hashlib.sha256()
    for rel in include_dirs:
        root = ROOT / rel
        if not root.exists():
            continue
        for file in sorted(root.rglob("*")):
            if not file.is_file():
                continue
            digest.update(file.relative_to(ROOT).as_posix().encode("utf-8"))
            digest.update(str(file.stat().st_mtime_ns).encode("utf-8"))
    for rel in include_files:
        file = ROOT / rel
        if not file.exists():
            continue
        digest.update(file.relative_to(ROOT).as_posix().encode("utf-8"))
        digest.update(str(file.stat().st_mtime_ns).encode("utf-8"))
    return digest.hexdigest()


def maybe_build_and_deploy() -> Path:
    build_frontend()
    return create_release()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def make_handler(api_origin: str | None):
    class SecureHandler(http.server.SimpleHTTPRequestHandler):
        def translate_path(self, path: str) -> str:
            root = get_current_release_dir()
            clean = urllib.parse.urlparse(path).path
            clean = clean.lstrip("/")
            target = root / clean
            if target.exists():
                return str(target)
            if "." not in clean:
                return str(root / "index.html")
            return str(target)

        def end_headers(self) -> None:
            self.send_header("Strict-Transport-Security", "max-age=31536000")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "connect-src 'self' https: wss:; "
                "font-src 'self' data:; "
                "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
            )
            super().end_headers()

        def do_GET(self) -> None:  # noqa: N802
            if api_origin and self.path.startswith("/api/"):
                self.proxy_to_api()
                return
            super().do_GET()

        def do_POST(self) -> None:  # noqa: N802
            if api_origin and self.path.startswith("/api/"):
                self.proxy_to_api()
                return
            self.send_error(404, "Not found")

        def do_PUT(self) -> None:  # noqa: N802
            if api_origin and self.path.startswith("/api/"):
                self.proxy_to_api()
                return
            self.send_error(404, "Not found")

        def do_DELETE(self) -> None:  # noqa: N802
            if api_origin and self.path.startswith("/api/"):
                self.proxy_to_api()
                return
            self.send_error(404, "Not found")

        def do_PATCH(self) -> None:  # noqa: N802
            if api_origin and self.path.startswith("/api/"):
                self.proxy_to_api()
                return
            self.send_error(404, "Not found")

        def do_OPTIONS(self) -> None:  # noqa: N802
            if api_origin and self.path.startswith("/api/"):
                self.proxy_to_api()
                return
            super().do_OPTIONS()

        def proxy_to_api(self) -> None:
            assert api_origin is not None
            parsed = urllib.parse.urlparse(api_origin)
            conn_cls = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
            request_path = urllib.parse.urlparse(self.path).path
            is_sse_request = request_path.endswith("/sync/events")

            def safe_send_error(status: int, message: str) -> None:
                try:
                    self.send_error(status, message)
                except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, OSError) as exc:
                    info(f"proxy_to_api: client disconnected before error response ({exc})")

            body = None
            length = int(self.headers.get("Content-Length", "0"))
            if length > 0:
                body = self.rfile.read(length)

            headers = {}
            for key, value in self.headers.items():
                lower = key.lower()
                if lower in ("host", "connection", "content-length", "accept-encoding"):
                    continue
                headers[key] = value
            headers["Host"] = parsed.netloc
            headers["X-Forwarded-Proto"] = "https"

            connection_kwargs: dict[str, object] = {"timeout": None if is_sse_request else 20}
            if (
                conn_cls is http.client.HTTPSConnection
                and parsed.hostname
                and parsed.hostname.lower() in ("localhost", "127.0.0.1", "::1")
            ):
                # Allow local self-signed certs used by the secure local deploy.
                local_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                local_ctx.check_hostname = False
                local_ctx.verify_mode = ssl.CERT_NONE
                connection_kwargs["context"] = local_ctx
            connection = conn_cls(parsed.hostname, parsed.port, **connection_kwargs)
            try:
                path = self.path
                try:
                    connection.request(self.command, path, body=body, headers=headers)
                    response = connection.getresponse()
                except ssl.SSLError as exc:
                    info(f"proxy_to_api SSL error: {exc}")
                    safe_send_error(502, "Bad gateway: SSL upstream error")
                    return
                except OSError as exc:
                    info(f"proxy_to_api upstream connection error: {exc}")
                    safe_send_error(502, "Bad gateway: upstream connection error")
                    return

                content_type = (response.getheader("Content-Type") or "").lower()
                response_is_sse = is_sse_request or "text/event-stream" in content_type

                self.send_response(response.status, response.reason)
                for key, value in response.getheaders():
                    lower = key.lower()
                    if lower in ("transfer-encoding", "connection", "content-length"):
                        continue
                    self.send_header(key, value)
                if response_is_sse:
                    # SSE must be streamed and should not include Content-Length.
                    self.send_header("Cache-Control", "no-cache")
                    self.send_header("X-Accel-Buffering", "no")
                    self.end_headers()
                    while True:
                        try:
                            chunk = response.read(16 * 1024)
                        except OSError as exc:
                            info(f"proxy_to_api SSE upstream read closed: {exc}")
                            break
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                            self.wfile.flush()
                        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, OSError):
                            break
                    return

                payload = response.read()
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                if payload:
                    try:
                        self.wfile.write(payload)
                    except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, OSError):
                        pass
            finally:
                connection.close()

        def log_message(self, fmt: str, *args: object) -> None:
            info(fmt % args)

    return SecureHandler


def start_http_redirect_thread(http_port: int, https_port: int) -> threading.Thread:
    class RedirectHandler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            location = f"https://localhost:{https_port}{self.path}"
            self.send_response(308)
            self.send_header("Location", location)
            self.end_headers()

        def do_POST(self) -> None:  # noqa: N802
            self.do_GET()

        def do_PUT(self) -> None:  # noqa: N802
            self.do_GET()

        def do_DELETE(self) -> None:  # noqa: N802
            self.do_GET()

        def log_message(self, fmt: str, *args: object) -> None:
            info(f"http-redirect: {fmt % args}")

    server = ThreadingHTTPServer(("0.0.0.0", http_port), RedirectHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    info(f"HTTP redirect enabled: http://localhost:{http_port} -> https://localhost:{https_port}")
    return thread


def start_node_api_https(
    *,
    api_port: int,
    cert_file: Path,
    key_file: Path,
    frontend_origin: str,
    use_https: bool,
) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["PORT"] = str(api_port)
    env["CORS_ORIGIN"] = frontend_origin
    env["APP_BASE_URL"] = frontend_origin
    if use_https:
        env["HTTPS_ENABLED"] = "true"
        env["HTTPS_CERT_PATH"] = str(cert_file)
        env["HTTPS_KEY_PATH"] = str(key_file)
        env["HTTP_REDIRECT_ENABLED"] = "false"
    else:
        env["HTTPS_ENABLED"] = "false"
    info("Starting Node API server")
    cmd = resolve_command(["node", "server/index.js"])
    try:
        return subprocess.Popen(cmd, cwd=str(ROOT), env=env)
    except FileNotFoundError:
        fail("No se encontro Node.js en PATH (node).")


def watch_for_updates(interval_seconds: int, stop_event: threading.Event) -> None:
    info("Watch mode enabled. Waiting for source changes...")
    last_hash = source_snapshot_hash()
    while not stop_event.is_set():
        time.sleep(max(1, interval_seconds))
        current_hash = source_snapshot_hash()
        if current_hash == last_hash:
            continue
        info("Changes detected. Rebuilding and deploying new release...")
        try:
            maybe_build_and_deploy()
            info("Update applied successfully.")
            last_hash = current_hash
        except SystemExit:
            info("Update failed. Keeping previous release active.")


def run_secure_stack(args: argparse.Namespace) -> None:
    ensure_dirs()

    cert_file = CERTS_DIR / "localhost.crt"
    key_file = CERTS_DIR / "localhost.key"
    ensure_local_https_cert(cert_file, key_file)

    if args.build_first:
        maybe_build_and_deploy()
    elif not CURRENT_RELEASE_FILE.exists():
        info("No active release detected. Building first release...")
        maybe_build_and_deploy()

    frontend_origin = f"https://localhost:{args.frontend_https_port}"
    api_scheme = "https" if args.api_https else "http"
    api_origin = f"{api_scheme}://localhost:{args.api_port}" if args.with_api else args.api_origin

    node_proc: subprocess.Popen[str] | None = None
    if args.with_api:
        node_proc = start_node_api_https(
            api_port=args.api_port,
            cert_file=cert_file,
            key_file=key_file,
            frontend_origin=frontend_origin,
            use_https=args.api_https,
        )
        time.sleep(1.2)

    if args.enable_http_redirect:
        start_http_redirect_thread(args.frontend_http_port, args.frontend_https_port)

    handler = make_handler(api_origin)
    server = ThreadingHTTPServer(("0.0.0.0", args.frontend_https_port), handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert_file), keyfile=str(key_file))
    server.socket = context.wrap_socket(server.socket, server_side=True)

    stop_event = threading.Event()
    watch_thread = None
    if args.watch:
        watch_thread = threading.Thread(
            target=watch_for_updates,
            args=(args.watch_interval, stop_event),
            daemon=True,
        )
        watch_thread.start()

    def shutdown(*_sig: object) -> None:
        stop_event.set()
        server.shutdown()
        if node_proc and node_proc.poll() is None:
            node_proc.terminate()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    info(f"Frontend HTTPS: {frontend_origin}")
    if args.enable_http_redirect:
        info(f"Frontend HTTP redirect: http://localhost:{args.frontend_http_port}")
    if api_origin:
        info(f"API origin/proxy: {api_origin}")
    info("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    finally:
        stop_event.set()
        if watch_thread:
            watch_thread.join(timeout=2)
        server.server_close()
        if node_proc and node_proc.poll() is None:
            node_proc.terminate()
            try:
                node_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                node_proc.kill()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Secure Python deploy manager for dist + local HTTPS + auto-updates."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("build", help="Build frontend and create a new release.")

    rollback = sub.add_parser("rollback", help="Rollback current release.")
    rollback.add_argument("--steps", type=int, default=1, help="How many releases back (default: 1).")

    serve = sub.add_parser("serve", help="Serve current release over HTTPS.")
    add_serve_options(serve)
    serve.set_defaults(build_first=False)

    full = sub.add_parser("full", help="Build + deploy + serve HTTPS with optional API.")
    add_serve_options(full)
    full.set_defaults(build_first=True)

    return parser.parse_args()


def add_serve_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--with-api", action="store_true", help="Start Node API server automatically.")
    parser.add_argument(
        "--api-https",
        action="store_true",
        help="Start Node API in HTTPS mode (recommended with --with-api).",
    )
    parser.add_argument(
        "--api-origin",
        default=None,
        help="External API origin to proxy /api (example: https://localhost:4000).",
    )
    parser.add_argument("--api-port", type=int, default=DEFAULT_API_HTTPS_PORT, help="Node API port.")
    parser.add_argument("--frontend-https-port", type=int, default=DEFAULT_FRONTEND_HTTPS_PORT, help="Frontend HTTPS port.")
    parser.add_argument(
        "--enable-http-redirect",
        action="store_true",
        help="Enable local HTTP->HTTPS redirect server for frontend.",
    )
    parser.add_argument("--frontend-http-port", type=int, default=DEFAULT_FRONTEND_HTTP_REDIRECT_PORT, help="Frontend HTTP redirect port.")
    parser.add_argument("--watch", action="store_true", help="Auto rebuild + deploy when source changes.")
    parser.add_argument("--watch-interval", type=int, default=3, help="Watch poll interval in seconds.")


def main() -> None:
    args = parse_args()
    ensure_dirs()

    if args.command == "build":
        maybe_build_and_deploy()
        info(f"Release activa: {get_current_release_dir().parent.name}")
        return

    if args.command == "rollback":
        rollback_release(args.steps)
        return

    if args.command in ("serve", "full"):
        if not args.with_api and not args.api_origin:
            info("No API server configured. Se servira solo frontend estatico.")
        run_secure_stack(args)
        return

    fail(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
