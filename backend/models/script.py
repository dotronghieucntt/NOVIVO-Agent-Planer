from database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone


class Script(Base):
    __tablename__ = "scripts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512), nullable=False)
    topic = Column(String(512), nullable=False)
    trend_source = Column(String(1024), nullable=True)  # URL or description of the trend
    script_data = Column(JSON, nullable=True)   # Structured: [{scene, audio, dialogue, action}]
    raw_script = Column(Text, nullable=True)    # Full markdown text
    duration_seconds = Column(Integer, nullable=True)
    status = Column(String(64), default="Ý tưởng")
    channel = Column(String(128), nullable=True)
    tags = Column(JSON, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="scripts")
    chat_messages = relationship("ChatMessage", back_populates="script")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(16), nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    script_id = Column(Integer, ForeignKey("scripts.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    script = relationship("Script", back_populates="chat_messages")
