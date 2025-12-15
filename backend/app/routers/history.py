from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ChatMessage, ChatSession
from ..schemas import ChatMessageSchema, ChatSessionSchema, SessionHistoryResponse, SessionListItem

router = APIRouter(prefix="/chat/history", tags=["history"])


@router.get("", response_model=list[SessionListItem])
def list_histories(db: Session = Depends(get_db)) -> list[SessionListItem]:
    sessions = (
        db.query(
            ChatSession.id,
            ChatSession.title,
            ChatSession.updated_at.label("last_updated"),
            func.count(ChatMessage.id).label("message_count"),
        )
        .join(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .group_by(ChatSession.id)
        .order_by(desc(ChatSession.updated_at))
        .all()
    )

    return [
        SessionListItem(
            id=row.id,
            title=row.title,
            last_updated=row.last_updated,
            message_count=row.message_count,
        )
        for row in sessions
    ]


@router.get("/{session_id}", response_model=SessionHistoryResponse)
def get_history(session_id: str, db: Session = Depends(get_db)) -> SessionHistoryResponse:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(200)
        .all()
    )

    return SessionHistoryResponse(
        session=ChatSessionSchema.model_validate(session),
        messages=[ChatMessageSchema.model_validate(m) for m in messages],
    )


@router.delete("/{session_id}", status_code=204)
def delete_history(session_id: str, db: Session = Depends(get_db)) -> None:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    db.delete(session)
    db.commit()
