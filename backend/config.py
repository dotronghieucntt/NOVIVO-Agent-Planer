from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "AI Content Planner"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./content_planner.db"

    # Security
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_RANDOM_32_CHARS"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Web Search (Tavily)
    TAVILY_API_KEY: str = ""

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    CHROMA_COLLECTION_NAME: str = "company_knowledge"

    # Content Settings
    HISTORY_DAYS: int = 30
    MAX_DUPLICATION_RATE: float = 0.15
    DEFAULT_TOPICS_PER_DAY: int = 3

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
