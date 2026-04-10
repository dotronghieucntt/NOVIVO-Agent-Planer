from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.user import User
from models.script import ChatMessage, Script
from models.content import ContentHistory
from core.deps import get_current_user
from services.agent_service import chat_with_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []   # [{"role": "user"|"assistant", "content": "..."}]
    script_id: int | None = None
    script_context: str = ""


def _build_db_context(db: Session, user_id: int) -> str:
    """Build a context string from user's recent DB data for the agent."""
    lines = []

    # Recent content history (topics)
    topics = (
        db.query(ContentHistory)
        .filter(ContentHistory.owner_id == user_id)
        .order_by(ContentHistory.created_at.desc())
        .limit(50)
        .all()
    )
    if topics:
        lines.append("=== LỊCH SỬ Ý TƯỞNG / CHỦ ĐỀ GẦN ĐÂY (50 mới nhất) ===")
        for t in topics:
            status = t.status.value if hasattr(t.status, 'value') else str(t.status)
            date_str = t.created_at.strftime("%d/%m/%Y") if t.created_at else ""
            channel_str = f" [{t.channel}]" if t.channel else ""
            angle_str = f" — {t.angle}" if t.angle else ""
            lines.append(f"- [{date_str}{channel_str}] [{status}] {t.topic}{angle_str}")
        lines.append("")

    # Recent scripts
    scripts = (
        db.query(Script)
        .filter(Script.owner_id == user_id)
        .order_by(Script.created_at.desc())
        .limit(20)
        .all()
    )
    if scripts:
        lines.append("=== KỊCH BẢN GẦN ĐÂY (20 mới nhất) ===")
        for s in scripts:
            date_str = s.created_at.strftime("%d/%m/%Y") if s.created_at else ""
            channel_str = f" [{s.channel}]" if s.channel else ""
            status_str = f" [{s.status}]" if s.status else ""
            tags_str = f" #{' #'.join(s.tags)}" if s.tags else ""
            lines.append(f"- [ID:{s.id}] [{date_str}{channel_str}{status_str}] {s.title}{tags_str}")
        lines.append("")

    return "\n".join(lines)


@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Streaming chat endpoint — returns text/event-stream."""
    full_response = []
    db_context = _build_db_context(db, current_user.id)

    async def event_generator():
        async for chunk in chat_with_agent(
            user_message=req.message,
            history=req.history,
            script_context=req.script_context,
            db_context=db_context,
            db=db,
            owner_id=current_user.id,
        ):
            full_response.append(chunk)
            yield f"data: {chunk}\n\n"

        # Save messages to DB after streaming completes
        user_msg = ChatMessage(
            role="user",
            content=req.message,
            script_id=req.script_id,
            owner_id=current_user.id,
        )
        ai_msg = ChatMessage(
            role="assistant",
            content="".join(full_response),
            script_id=req.script_id,
            owner_id=current_user.id,
        )
        db.add_all([user_msg, ai_msg])
        db.commit()
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/history")
def get_chat_history(
    script_id: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ChatMessage).filter(ChatMessage.owner_id == current_user.id)
    if script_id:
        query = query.filter(ChatMessage.script_id == script_id)
    messages = query.order_by(ChatMessage.created_at.asc()).limit(limit).all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
