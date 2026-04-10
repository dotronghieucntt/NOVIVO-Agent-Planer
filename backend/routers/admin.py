from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from database import get_db
from models.user import User, UserRole
from models.content import KnowledgeDocument, KnowledgeSource
from core.deps import require_admin, get_current_user
from core.security import get_password_hash
from services.rag_service import add_document, delete_document, invalidate_source_cache

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── Users ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str = ""
    role: UserRole = UserRole.staff


class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None
    full_name: str | None = None


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]


@router.post("/users", status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username đã tồn tại")
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role}


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return {"updated": True}


# ─── Knowledge Sources (groups) ─────────────────────────────────────────────

class SourceCreate(BaseModel):
    name: str
    description: str = ""


class SourceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: int | None = None


@router.get("/sources")
def list_sources(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    doc_counts = dict(
        db.query(KnowledgeDocument.source_id, func.count(KnowledgeDocument.id))
        .filter(KnowledgeDocument.source_id != None)  # noqa: E711
        .group_by(KnowledgeDocument.source_id)
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "is_active": bool(s.is_active),
            "doc_count": doc_counts.get(s.id, 0),
            "created_at": s.created_at.isoformat(),
        }
        for s in db.query(KnowledgeSource).all()
    ]


@router.post("/sources", status_code=201)
def create_source(
    data: SourceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    src = KnowledgeSource(name=data.name, description=data.description, is_active=1)
    db.add(src)
    db.commit()
    db.refresh(src)
    invalidate_source_cache()
    return {"id": src.id, "name": src.name, "description": src.description,
            "is_active": bool(src.is_active), "doc_count": 0,
            "created_at": src.created_at.isoformat()}


@router.patch("/sources/{source_id}")
def update_source(
    source_id: int,
    data: SourceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    src = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Nhóm nguồn không tồn tại")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(src, field, value)
    db.commit()
    invalidate_source_cache()
    return {"id": src.id, "name": src.name, "is_active": bool(src.is_active)}


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    src = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Nhóm nguồn không tồn tại")
    # Unlink docs (don't delete them)
    db.query(KnowledgeDocument).filter(KnowledgeDocument.source_id == source_id).update(
        {"source_id": None}
    )
    db.delete(src)
    db.commit()
    invalidate_source_cache()


# ─── Knowledge Base ───────────────────────────────────────────────────────────

class DocCreate(BaseModel):
    title: str
    category: str
    content: str
    source_id: int | None = None


class CrawlRequest(BaseModel):
    url: str
    category: str = "other"
    max_pages: int = 30
    max_depth: int = 2
    source_id: int | None = None


@router.post("/knowledge/crawl")
async def crawl_and_add_knowledge(
    data: CrawlRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    import logging as _log
    from urllib.parse import urlparse as _parse
    from services.crawler_service import crawl_site

    parsed = _parse(data.url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=400, detail="URL không hợp lệ — chỉ hỗ trợ http/https")

    max_pages = max(1, min(data.max_pages, 50))
    max_depth = max(1, min(data.max_depth, 3))

    try:
        pages = await crawl_site(data.url, max_pages=max_pages, max_depth=max_depth)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi crawl: {e}")

    if not pages:
        raise HTTPException(status_code=422, detail="Không tìm thấy nội dung nào từ URL này")

    _logger = _log.getLogger(__name__)
    added: list[dict] = []
    for page in pages:
        doc = KnowledgeDocument(
            title=page["title"][:200],
            category=data.category,
            content=f"Nguồn: {page['url']}\n\n{page['content']}",
            is_embedded=0,
            source_id=data.source_id,
        )
        db.add(doc)
        db.flush()  # get ID before embed
        try:
            add_document(
                doc_id=str(doc.id),
                content=doc.content,
                metadata={"title": doc.title, "category": data.category, "source_url": page["url"]},
            )
            doc.is_embedded = 1
        except Exception as embed_err:
            _logger.warning("Embed failed for %s: %s", page["url"], embed_err)
        added.append({"id": doc.id, "title": doc.title, "url": page["url"]})

    db.commit()
    invalidate_source_cache()
    return {"added": len(added), "docs": added}


@router.get("/knowledge")
def list_knowledge(
    source_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(KnowledgeDocument)
    if source_id is not None:
        q = q.filter(KnowledgeDocument.source_id == source_id)
    docs = q.all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "category": d.category,
            "is_embedded": bool(d.is_embedded),
            "source_id": d.source_id,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.post("/knowledge", status_code=201)
def add_knowledge(
    data: DocCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = KnowledgeDocument(
        title=data.title,
        category=data.category,
        content=data.content,
        is_embedded=0,
        source_id=data.source_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    invalidate_source_cache()

    # Embed into ChromaDB (best-effort — may fail if DLL/native deps unavailable)
    try:
        add_document(
            doc_id=str(doc.id),
            content=data.content,
            metadata={"title": data.title, "category": data.category},
        )
        doc.is_embedded = 1
        db.commit()
    except Exception as embed_err:
        import logging
        logging.getLogger(__name__).warning(
            "ChromaDB embed failed (will retry later): %s", embed_err
        )

    return {"id": doc.id, "title": doc.title, "is_embedded": bool(doc.is_embedded)}


@router.get("/knowledge/{doc_id}")
def get_knowledge(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    return {
        "id": doc.id,
        "title": doc.title,
        "category": doc.category,
        "content": doc.content,
        "is_embedded": bool(doc.is_embedded),
        "created_at": doc.created_at.isoformat(),
    }


class DocUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    content: str | None = None


@router.patch("/knowledge/{doc_id}")
def update_knowledge(
    doc_id: int,
    data: DocUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    if data.title is not None:
        doc.title = data.title
    if data.category is not None:
        doc.category = data.category
    if data.content is not None:
        doc.content = data.content
        # Re-embed with updated content (best-effort)
        try:
            add_document(
                doc_id=str(doc.id),
                content=data.content,
                metadata={"title": doc.title, "category": doc.category},
            )
            doc.is_embedded = 1
        except Exception as embed_err:
            import logging
            logging.getLogger(__name__).warning("Re-embed failed: %s", embed_err)
    db.commit()
    invalidate_source_cache()
    return {"id": doc.id, "title": doc.title, "is_embedded": bool(doc.is_embedded)}


@router.delete("/knowledge/{doc_id}", status_code=204)
def remove_knowledge(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Tài liệu không tồn tại")
    delete_document(str(doc_id))
    db.delete(doc)
    db.commit()
    invalidate_source_cache()


# ─── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    from models.script import Script
    from models.content import ContentHistory
    return {
        "total_users": db.query(User).count(),
        "total_scripts": db.query(Script).count(),
        "total_topics": db.query(ContentHistory).count(),
        "total_knowledge_docs": db.query(KnowledgeDocument).count(),
        "scripts_by_status": {
            s: db.query(Script).filter(Script.status == s).count()
            for s in ["Ý tưởng", "Đang quay", "Đã dựng", "Đã đăng"]
        },
    }
