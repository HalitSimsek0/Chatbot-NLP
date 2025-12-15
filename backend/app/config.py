from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT_DIR / "data"
DEFAULT_MODEL_DIR = ROOT_DIR / "models"


class Settings(BaseSettings):
    app_name: str = Field(default="ISTE Chatbot API", description="Application name")
    api_prefix: str = Field(default="/api", description="Root API prefix")
    version: str = Field(default="0.1.0", description="API version")

    sqlite_path: Path = Field(
        default=DEFAULT_DATA_DIR / "chat_history.db",
        description="SQLite file path for persisting chat history.",
    )

    model_dir: Path = Field(
        default=DEFAULT_MODEL_DIR / "20251116_191825",
        description="Directory that holds the fine-tuned model artifacts.",
    )
    vector_store_path: Optional[Path] = Field(
        default=DEFAULT_MODEL_DIR / "20251116_191825" / "vector_store.joblib",
        description="Path to serialized vector store containing TF-IDF matrices.",
    )

    max_history_items: int = Field(
        default=50,
        description="Maximum number of previous messages to return in chat history endpoints.",
    )

    class Config:
        env_file = ROOT_DIR / ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def database_url(self) -> str:
        db_path = self.sqlite_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path.as_posix()}"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
