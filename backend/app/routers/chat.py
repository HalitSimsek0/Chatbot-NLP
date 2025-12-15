from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ChatMessage, ChatSession
from ..schemas import ChatRequest, ChatResponse
from ..services.nlp import NLPService, get_nlp_service

router = APIRouter(prefix="/chat", tags=["chat"])


def _get_nlp_cached() -> NLPService:
    if not hasattr(_get_nlp_cached, "_instance"):
        _get_nlp_cached._instance = get_nlp_service()
    return _get_nlp_cached._instance  # type: ignore[attr-defined]


def _ensure_session(db: Session, session_id: Optional[str]) -> ChatSession:
    if session_id:
        chat_session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if chat_session:
            return chat_session
        raise HTTPException(status_code=404, detail="Session not found")

    chat_session = ChatSession()
    db.add(chat_session)
    db.flush()
    return chat_session


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    nlp: NLPService = Depends(_get_nlp_cached),
) -> ChatResponse:
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz")

    chat_session = _ensure_session(db, payload.session_id)

    user_message = ChatMessage(
        session_id=chat_session.id,
        sender="user",
        text=payload.message.strip(),
    )
    db.add(user_message)
    db.flush()

    answer = nlp.predict(payload.message)

    bot_message = ChatMessage(
        session_id=chat_session.id,
        sender="bot",
        text=answer.text,
        category=answer.category,
        subcategory=answer.subcategory,
        confidence=answer.confidence,
    )
    db.add(bot_message)

    if not chat_session.title and payload.message:
        snippet = payload.message.strip()[:60]
        chat_session.title = snippet + ("..." if len(payload.message.strip()) > 60 else "")

    chat_session.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(chat_session)

    return ChatResponse(
        session_id=chat_session.id,
        message=answer.text,
        category=answer.category,
        subcategory=answer.subcategory,
        confidence=answer.confidence,
        similar_questions=answer.similar_questions,
        suggested_links=answer.suggested_links,
    )
