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

from PyInstaller.utils.hooks import collect_all, collect_data_files

block_cipher = None

# ── Auto-collect tất cả imports từ các package chính ─────────────────────────
datas = []
binaries = []
hiddenimports = []

_packages = [
    "uvicorn",
    "fastapi",
    "starlette",
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
    "python_dotenv",
    "dotenv",
]

for _pkg in _packages:
    try:
        _d, _b, _h = collect_all(_pkg)
        datas += _d
        binaries += _b
        hiddenimports += _h
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
