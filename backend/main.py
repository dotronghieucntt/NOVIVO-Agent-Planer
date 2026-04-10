from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import traceback
import logging
import sys
import io

# Ensure stdout/stderr use UTF-8 in frozen exe (Windows cp1252 default breaks emoji)
if hasattr(sys.stdout, 'reconfigure'):
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
if hasattr(sys.stderr, 'reconfigure'):
    try: sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

logging.basicConfig(level=logging.INFO)
logging.getLogger("deps").setLevel(logging.DEBUG)
from database import init_db
from models.user import User, UserRole
from database import SessionLocal
from core.security import get_password_hash
from routers import auth_router, planning_router, chat_router, content_router, admin_router, settings_router
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB and seed default admin
    init_db()
    _seed_admin()
    _seed_default_source()
    yield


def _seed_admin():
    """Create default admin if none exists."""
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.role == UserRole.admin).first():
            admin = User(
                username="admin",
                email="admin@company.com",
                hashed_password=get_password_hash("Admin@123"),
                full_name="Administrator",
                role=UserRole.admin,
            )
            db.add(admin)
            db.commit()
            print("[OK] Default admin created: admin / Admin@123 -- CHANGE THIS PASSWORD!")
    finally:
        db.close()


def _seed_default_source():
    """Create a default knowledge source and seed bundled default documents on first run."""
    from models.content import KnowledgeSource, KnowledgeDocument
    import json as _json
    db = SessionLocal()
    try:
        if not db.query(KnowledgeSource).first():
            src = KnowledgeSource(
                name="Mặc định",
                description="Nguồn dữ liệu ban đầu",
                is_active=1,
            )
            db.add(src)
            db.flush()

            # Assign any existing unassigned docs (dev/migration)
            count = (
                db.query(KnowledgeDocument)
                .filter(KnowledgeDocument.source_id == None)  # noqa: E711
                .update({"source_id": src.id})
            )

            # Load bundled default_knowledge.json (shipped with the exe)
            _here = getattr(__import__('sys'), '_MEIPASS', None) or \
                    __import__('os').path.dirname(__file__)
            _json_path = __import__('os').path.join(_here, 'default_knowledge.json')
            if __import__('os').path.exists(_json_path):
                with open(_json_path, encoding='utf-8') as _f:
                    _docs = _json.load(_f)
                for _d in _docs:
                    db.add(KnowledgeDocument(
                        title=_d.get('title', ''),
                        category=_d.get('category'),
                        content=_d.get('content', ''),
                        is_embedded=0,
                        source_id=src.id,
                    ))
                count += len(_docs)
                print(f"[OK] Seeded {len(_docs)} default knowledge docs from bundle")
            else:
                print(f"[WARN] default_knowledge.json not found at {_json_path}")

            db.commit()
            print(f"[OK] Default knowledge source created (id={src.id}), {count} docs total")
    finally:
        db.close()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI Content Planner API — Powered by Gemini",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8001",
        "tauri://localhost",
        "null",          # Electron file:// origin
    ],
    allow_origin_regex=r"file://.*",   # catch all file:// variants
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(planning_router)
app.include_router(chat_router)
app.include_router(content_router)
app.include_router(admin_router)
app.include_router(settings_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException as FastHTTPException
    from starlette.exceptions import HTTPException as StarletteHTTPException
    # Don't intercept HTTPExceptions — let FastAPI handle them normally
    if isinstance(exc, (FastHTTPException, StarletteHTTPException)):
        raise exc
    tb = traceback.format_exc()
    print(f"[UNHANDLED ERROR] {request.method} {request.url}\n{tb}", flush=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


if __name__ == "__main__":
    import uvicorn
    import sys as _sys
    if getattr(_sys, 'frozen', False):
        # Frozen exe (PyInstaller): pass app object directly so uvicorn never
        # tries to import via string (which triggers watchfiles reloader).
        # reload=False is mandatory – watchfiles restarts the exe endlessly.
        uvicorn.run(app, host="127.0.0.1", port=8001, reload=False)
    else:
        uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=settings.DEBUG)
