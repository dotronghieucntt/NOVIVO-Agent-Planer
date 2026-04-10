from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from database import get_db
from models.user import User
from models.content import ContentHistory, ContentStatus
from models.script import Script
from core.deps import get_current_user
from services.agent_service import generate_daily_topics, write_script

router = APIRouter(prefix="/api/planning", tags=["planning"])


class PlanRequest(BaseModel):
    channel: str = "TikTok chung"
    num_topics: int = 3
    extra_context: str = ""


class TopicOut(BaseModel):
    title: str
    angle: str
    hook: str
    estimated_duration: int
    tags: list[str]


class ScriptRequest(BaseModel):
    topic: str
    angle: str = ""
    duration_seconds: int = 60
    channel: str = ""
    style_notes: str = ""
    save: bool = True


class IdeaCreateRequest(BaseModel):
    topic: str
    angle: str = ""
    channel: str = "TikTok chung"
    status: str = "Ý tưởng"


class IdeaUpdateRequest(BaseModel):
    topic: Optional[str] = None
    angle: Optional[str] = None
    channel: Optional[str] = None
    status: Optional[str] = None


@router.post("/topics")
async def plan_topics(
    req: PlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate 2-3 anti-duplicate topic ideas for today."""
    since = datetime.now(timezone.utc) - timedelta(days=30)
    past = db.query(ContentHistory.topic).filter(
        ContentHistory.created_at >= since
    ).all()
    past_topics = [row[0] for row in past]

    try:
        topics = await generate_daily_topics(
            past_topics=past_topics,
            channel=req.channel,
            num_topics=req.num_topics,
            extra_context=req.extra_context,
        )
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err or "spending cap" in err.lower():
            raise HTTPException(status_code=429, detail="Gemini API đã hết quota / vượt spending cap. Vào AI Studio để kiểm tra.")
        if "503" in err or "UNAVAILABLE" in err or "high demand" in err.lower():
            raise HTTPException(status_code=503, detail="AI đang quá tải, vui lòng thử lại sau ít phút.")
        raise HTTPException(status_code=500, detail=f"Lỗi tạo chủ đề: {err[:200]}")
    return {"topics": topics}


@router.post("/script")
async def create_script(
    req: ScriptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a full shooting script and optionally save it."""
    try:
        script_data = await write_script(
            topic=req.topic,
            angle=req.angle,
            duration_seconds=req.duration_seconds,
            channel=req.channel,
            style_notes=req.style_notes,
        )
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err or "spending cap" in err.lower():
            raise HTTPException(status_code=429, detail="Gemini API đã hết quota / vượt spending cap. Vào AI Studio để kiểm tra.")
        if "503" in err or "UNAVAILABLE" in err or "high demand" in err.lower():
            raise HTTPException(status_code=503, detail="AI đang quá tải, vui lòng thử lại sau ít phút.")
        raise HTTPException(status_code=500, detail=f"Lỗi tạo kịch bản: {err[:200]}")

    if req.save:
        # Save topic to history (anti-duplication tracking)
        history = ContentHistory(
            topic=req.topic,
            angle=req.angle,
            channel=req.channel,
            owner_id=current_user.id,
        )
        db.add(history)

        # Save script
        script = Script(
            title=script_data.get("title", req.topic),
            topic=req.topic,
            script_data=script_data,
            raw_script=str(script_data),
            duration_seconds=req.duration_seconds,
            channel=req.channel,
            tags=script_data.get("hashtags", []),
            owner_id=current_user.id,
        )
        db.add(script)
        db.commit()
        db.refresh(script)
        return {"script": script_data, "saved_id": script.id}

    return {"script": script_data}


@router.get("/history")
def get_history(
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ContentHistory).filter(
        ContentHistory.owner_id == current_user.id
    ).order_by(ContentHistory.created_at.desc())
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": h.id,
                "topic": h.topic,
                "angle": h.angle,
                "channel": h.channel,
                "status": h.status,
                "created_at": h.created_at.isoformat(),
            }
            for h in items
        ],
    }


def _idea_out(h: ContentHistory) -> dict:
    return {
        "id": h.id,
        "topic": h.topic,
        "angle": h.angle or "",
        "channel": h.channel or "",
        "status": h.status.value if hasattr(h.status, "value") else str(h.status),
        "created_at": h.created_at.isoformat() if h.created_at else "",
    }


@router.get("/ideas")
def list_ideas(
    limit: int = Query(50, le=200),
    offset: int = 0,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all ideas/topics with optional status filter."""
    query = db.query(ContentHistory).filter(
        ContentHistory.owner_id == current_user.id
    ).order_by(ContentHistory.created_at.desc())
    if status:
        query = query.filter(ContentHistory.status == status)
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return {"total": total, "items": [_idea_out(h) for h in items]}


@router.post("/ideas", status_code=201)
def create_idea(
    req: IdeaCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually create a new idea."""
    h = ContentHistory(
        topic=req.topic,
        angle=req.angle,
        channel=req.channel,
        owner_id=current_user.id,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _idea_out(h)


@router.patch("/ideas/{idea_id}")
def update_idea(
    idea_id: int,
    req: IdeaUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update topic, angle, channel or status of an idea."""
    h = db.query(ContentHistory).filter(
        ContentHistory.id == idea_id,
        ContentHistory.owner_id == current_user.id,
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Không tìm thấy ý tưởng")
    if req.topic is not None:
        h.topic = req.topic
    if req.angle is not None:
        h.angle = req.angle
    if req.channel is not None:
        h.channel = req.channel
    if req.status is not None:
        h.status = req.status
    db.commit()
    db.refresh(h)
    return _idea_out(h)


@router.delete("/ideas/{idea_id}", status_code=204)
def delete_idea(
    idea_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an idea."""
    h = db.query(ContentHistory).filter(
        ContentHistory.id == idea_id,
        ContentHistory.owner_id == current_user.id,
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Không tìm thấy ý tưởng")
    db.delete(h)
    db.commit()
