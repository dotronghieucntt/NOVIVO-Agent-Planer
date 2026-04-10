from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite only
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and seed default admin user."""
    from models import user, content, script, setting  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Migration: add source_id column to knowledge_documents if not already present
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE knowledge_documents ADD COLUMN source_id INTEGER REFERENCES knowledge_sources(id)"
            ))
            conn.commit()
    except Exception:
        pass  # Column already exists — ignore
