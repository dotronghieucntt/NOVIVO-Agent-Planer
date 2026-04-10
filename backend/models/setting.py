from database import Base
from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime, timezone


class SystemSetting(Base):
    """Key-value store for runtime-configurable settings (API keys, model names, etc.)."""
    __tablename__ = "system_settings"

    key = Column(String(128), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
