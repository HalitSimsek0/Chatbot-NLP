from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User query text")
    session_id: Optional[str] = Field(None, alias="sessionId", description="Existing chat session identifier")

    model_config = {"populate_by_name": True}


class GeneratedAnswer(BaseModel):
    text: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    confidence: Optional[float] = None
    similar_questions: list[str] = Field(default_factory=list, alias="similarQuestions")
    suggested_links: list[str] = Field(default_factory=list, alias="suggestedLinks")

    model_config = {"populate_by_name": True}


class ChatResponse(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    message: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    confidence: Optional[float] = None
    similar_questions: list[str] = Field(default_factory=list, alias="similarQuestions")
    suggested_links: list[str] = Field(default_factory=list, alias="suggestedLinks")

    model_config = {"populate_by_name": True}


class ChatMessageSchema(BaseModel):
    id: Optional[int] = None
    sender: Literal["user", "bot"]
    text: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    confidence: Optional[float] = None
    created_at: Optional[datetime] = Field(None, alias="createdAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


class ChatSessionSchema(BaseModel):
    id: str
    title: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


class SessionHistoryResponse(BaseModel):
    session: ChatSessionSchema
    messages: list[ChatMessageSchema]


class SessionListItem(BaseModel):
    id: str
    title: Optional[str] = None
    last_updated: datetime = Field(alias="lastUpdated")
    message_count: int = Field(alias="messageCount")

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
