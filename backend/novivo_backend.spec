# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller build spec cho NOVIVO Agent Planer Backend.

Build (LUÔN dùng venv PyInstaller):
  cd backend
  venv\Scripts\pyinstaller.exe novivo_backend.spec ^
      --distpath ..\dist-backend ^
      --workpath ..\build-backend ^
      --noconfirm --clean
"""

import os, sys
from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

block_cipher = None

# ── Packages cần collect_all ──────────────────────────────────────────────────
_PACKAGES = [
    "fastapi",
    "starlette",
    "uvicorn",
    "pydantic",
    "pydantic_settings",
    "sqlalchemy",
    "aiosqlite",
    "passlib",
    "jose",
    "multipart",
    "google.genai",
    "google.ai",
    "langchain",
    "langchain_community",
    "langchain_google_genai",
    "chromadb",
    "sentence_transformers",
    "tavily",
    "httpx",
    "anyio",
    "click",
    "h11",
    "httptools",
    "websockets",
    "watchfiles",
    "dotenv",
    "requests",
    "certifi",
    "charset_normalizer",
    "grpc",
    "proto",
    "tenacity",
    "packaging",
    "typing_extensions",
    "bcrypt",
    "docx",
    "pypdf",
]

datas = []
binaries = []
hiddenimports = []

for _pkg in _PACKAGES:
    try:
        _d, _b, _h = collect_all(_pkg)
        datas += _d
        binaries += _b
        hiddenimports += _h
        print(f"[OK]   collect_all({_pkg!r})")
    except Exception as _e:
        print(f"[WARN] collect_all({_pkg!r}) skipped: {_e}")

# ── Hidden imports bắt buộc ───────────────────────────────────────────────────
hiddenimports += [
    # uvicorn dynamic loaders
    "uvicorn.logging",
    "uvicorn.loops", "uvicorn.loops.auto", "uvicorn.loops.asyncio",
    "uvicorn.protocols", "uvicorn.protocols.http", "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl", "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.websockets", "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan", "uvicorn.lifespan.on", "uvicorn.lifespan.off",
    # SQLAlchemy
    "sqlalchemy.dialects.sqlite", "sqlalchemy.dialects.sqlite.pysqlite",
    # passlib
    "passlib.handlers.bcrypt", "passlib.handlers.md5_crypt", "passlib.handlers.sha2_crypt",
    # jose
    "jose.jwt", "jose.exceptions",
    # anyio
    "anyio.from_thread", "anyio._backends._asyncio",
    # multipart
    "python_multipart", "multipart.multipart",
    # email
    "email_validator",
]

# ── Data files bundled ────────────────────────────────────────────────────────
datas += [
    (".env.example", "."),
    ("default_knowledge.json", "."),
]

# ── Analysis ──────────────────────────────────────────────────────────────────
a = Analysis(
    ["main.py"],
    pathex=[SPECPATH],  # noqa: F821
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
