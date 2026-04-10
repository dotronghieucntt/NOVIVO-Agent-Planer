from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.user import User
from models.script import Script
from models.content import ContentHistory, ContentStatus
from core.deps import get_current_user

router = APIRouter(prefix="/api/content", tags=["content"])


class ScriptUpdate(BaseModel):
    title: str | None = None
    raw_script: str | None = None
    status: str | None = None
    channel: str | None = None
    tags: list[str] | None = None


@router.get("/scripts")
def list_scripts(
    status: str | None = None,
    channel: str | None = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Script).filter(Script.owner_id == current_user.id)
    if status:
        query = query.filter(Script.status == status)
    if channel:
        query = query.filter(Script.channel == channel)
    total = query.count()
    scripts = query.order_by(Script.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "scripts": [
            {
                "id": s.id,
                "title": s.title,
                "topic": s.topic,
                "status": s.status,
                "channel": s.channel,
                "tags": s.tags,
                "duration_seconds": s.duration_seconds,
                "created_at": s.created_at.isoformat(),
            }
            for s in scripts
        ],
    }


@router.get("/scripts/{script_id}")
def get_script(
    script_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    script = db.query(Script).filter(
        Script.id == script_id, Script.owner_id == current_user.id
    ).first()
    if not script:
        raise HTTPException(status_code=404, detail="Kịch bản không tồn tại")
    return {
        "id": script.id,
        "title": script.title,
        "topic": script.topic,
        "script_data": script.script_data,
        "raw_script": script.raw_script,
        "status": script.status,
        "channel": script.channel,
        "tags": script.tags,
        "duration_seconds": script.duration_seconds,
        "created_at": script.created_at.isoformat(),
    }


@router.patch("/scripts/{script_id}")
def update_script(
    script_id: int,
    data: ScriptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    script = db.query(Script).filter(
        Script.id == script_id, Script.owner_id == current_user.id
    ).first()
    if not script:
        raise HTTPException(status_code=404, detail="Kịch bản không tồn tại")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(script, field, value)
    db.commit()
    db.refresh(script)
    return {"id": script.id, "status": script.status, "title": script.title}


@router.delete("/scripts/{script_id}", status_code=204)
def delete_script(
    script_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    script = db.query(Script).filter(
        Script.id == script_id, Script.owner_id == current_user.id
    ).first()
    if not script:
        raise HTTPException(status_code=404, detail="Kịch bản không tồn tại")
    db.delete(script)
    db.commit()


@router.get("/kanban")
def get_kanban(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return scripts grouped by Kanban status."""
    statuses = ["Ý tưởng", "Đang tạo AI", "Hoàn thiện", "Đã đăng"]
    result = {}
    for s in statuses:
        scripts = db.query(Script).filter(
            Script.owner_id == current_user.id, Script.status == s
        ).order_by(Script.created_at.desc()).all()
        result[s] = [
            {
                "id": sc.id,
                "title": sc.title,
                "topic": sc.topic,
                "channel": sc.channel,
                "tags": sc.tags,
                "duration_seconds": sc.duration_seconds,
                "created_at": sc.created_at.isoformat(),
            }
            for sc in scripts
        ]
    return result
