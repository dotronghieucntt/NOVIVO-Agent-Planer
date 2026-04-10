# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller build spec cho NOVIVO Agent Planer Backend.

Build:
  cd backend
  venv\Scripts\pyinstaller.exe novivo_backend.spec ^
      --distpath ..\dist-backend ^
      --workpath ..\build-tmp\backend ^
      --noconfirm --clean

Output:
  dist-backend\novivo_backend\novivo_backend.exe   ← entry point
"""

import ast, os, sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_data_files

block_cipher = None

# ═══════════════════════════════════════════════════════════════════
# BƯỚC 1: Tự quét tất cả file .py trong project → phát hiện imports
# ═══════════════════════════════════════════════════════════════════
_SPEC_DIR = Path(SPECPATH)  # noqa: F821 – PyInstaller injects SPECPATH

def _scan_imports(root: Path) -> set[str]:
    """Parse tất cả .py file, trả về top-level package names."""
    found = set()
    for py in root.rglob("*.py"):
        # bỏ qua venv
        if "venv" in py.parts or "__pycache__" in py.parts:
            continue
        try:
            tree = ast.parse(py.read_text(encoding="utf-8", errors="ignore"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    found.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom):
                if node.module and node.level == 0:
                    found.add(node.module.split(".")[0])
    return found

_scanned = _scan_imports(_SPEC_DIR)
print(f"[SCAN] Phát hiện {len(_scanned)} top-level packages từ source code")

# ── Danh sách package cần collect_all (base + scanned) ───────────────────────
# Ánh xạ tên import → tên package PyPI/collect_all thực tế
_IMPORT_TO_PKG = {
    "jose":        "jose",
    "multipart":   "multipart",
    "dotenv":      "dotenv",
    "cv2":         None,   # optional – bỏ qua nếu không cài
    "torch":       None,
    "tensorflow":  None,
}

_BASE_PACKAGES = [
    "uvicorn", "fastapi", "starlette",
    "pydantic", "pydantic_settings",
    "sqlalchemy", "aiosqlite",
    "passlib", "jose", "multipart",
    "google.genai", "google.ai",
    "langchain", "langchain_community", "langchain_google_genai",
    "chromadb", "sentence_transformers",
    "tavily", "httpx",
    "anyio", "click", "h11", "httptools",
    "websockets", "watchfiles",
    "python_dotenv", "dotenv",
    "requests", "certifi", "charset_normalizer",
    "grpc", "proto",
    "tenacity", "packaging", "typing_extensions",
]

# Gộp scanned imports vào base (bỏ stdlib + None-mapped)
import sys as _sys
_stdlib = set(_sys.stdlib_module_names) if hasattr(_sys, "stdlib_module_names") else set()
_skip = {"__future__", "typing", "abc", "os", "sys", "re", "json", "io",
         "time", "math", "copy", "enum", "pathlib", "logging", "datetime",
         "collections", "functools", "itertools", "contextlib", "threading",
         "subprocess", "shutil", "tempfile", "uuid", "hashlib", "base64",
         "urllib", "http", "traceback", "warnings", "dataclasses", "inspect",
         # local packages (sẽ được Analysis tự xử lý)
         "config", "database", "models", "routers", "services", "core"}
_skip |= _stdlib

_all_packages = list(dict.fromkeys(
    _BASE_PACKAGES + [
        _IMPORT_TO_PKG.get(p, p)
        for p in sorted(_scanned)
        if p not in _skip and _IMPORT_TO_PKG.get(p, p) is not None
    ]
))

# ── Chạy collect_all cho từng package ────────────────────────────────────────
datas = []
binaries = []
hiddenimports = []

for _pkg in _all_packages:
    try:
        _d, _b, _h = collect_all(_pkg)
        datas += _d
        binaries += _b
        hiddenimports += _h
        print(f"[OK]   collect_all({_pkg!r})")
    except Exception as _e:
        print(f"[WARN] collect_all({_pkg!r}) skipped: {_e}")

# ── Hidden imports thường bị bỏ sót ──────────────────────────────────────────
hiddenimports += [
    # uvicorn dynamic loaders
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    # SQLAlchemy dialect
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.dialects.sqlite.pysqlite",
    # passlib crypto handlers
    "passlib.handlers.bcrypt",
    "passlib.handlers.md5_crypt",
    "passlib.handlers.sha2_crypt",
    # email / jwt
    "email_validator",
    "dns",
    "dns.resolver",
    "jose.jwt",
    "jose.exceptions",
    # async
    "anyio.from_thread",
    "anyio._backends._asyncio",
    # multipart
    "python_multipart",
    "multipart.multipart",
]

# ── Dữ liệu đi kèm ───────────────────────────────────────────────────────────
# Thêm .env.example để user biết cần điền gì
datas += [
    (".env.example", "."),
]

# ── Analysis ──────────────────────────────────────────────────────────────────
a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=list(set(hiddenimports)),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "PIL",
        "cv2",
        "torch",
        "tensorflow",
        "notebook",
        "IPython",
        "jupyter",
        "pytest",
        "setuptools",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="novivo_backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # console=True để xem log khi cần debug
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

# --onedir: nhanh hơn --onefile và không cần giải nén mỗi lần chạy
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="novivo_backend",
)
