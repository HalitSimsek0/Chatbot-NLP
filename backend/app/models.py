from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: str | None = Column(String(160), nullable=True)
    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: str = Column(String(36), ForeignKey("chat_sessions.id"), nullable=False, index=True)
    sender: str = Column(String(16), nullable=False)  # 'user' or 'bot'
    text: str = Column(Text, nullable=False)
    category: str | None = Column(String(64), nullable=True)
    subcategory: str | None = Column(String(128), nullable=True)
    confidence: float | None = Column(Float, nullable=True)
    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")
























