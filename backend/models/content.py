from database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum


class ContentStatus(str, enum.Enum):
    idea = "Ý tưởng"
    generating = "Đang tạo AI"
    ready = "Hoàn thiện"
    published = "Đã đăng"


class ContentHistory(Base):
    """Tracks all topics/ideas generated — used for anti-duplication."""
    __tablename__ = "content_history"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String(512), nullable=False)
    angle = Column(String(512), nullable=True)
    channel = Column(String(128), nullable=True)
    status = Column(SAEnum(ContentStatus), default=ContentStatus.idea)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    published_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="content_history")


class KnowledgeSource(Base):
    """A named group of knowledge documents. Active sources are used by AI."""
    __tablename__ = "knowledge_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Integer, default=1)  # 1=active, 0=inactive
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("KnowledgeDocument", back_populates="source")


class KnowledgeDocument(Base):
    """Company knowledge stored in DB (source of truth before embedding into ChromaDB)."""
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(256), nullable=False)
    category = Column(String(128), nullable=True)  # brand_voice, product, regulation
    content = Column(Text, nullable=False)
    is_embedded = Column(Integer, default=0)  # 0=pending, 1=embedded
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate=lambda: datetime.now(timezone.utc))

    source = relationship("KnowledgeSource", back_populates="documents")
