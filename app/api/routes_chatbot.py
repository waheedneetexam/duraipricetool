from fastapi import APIRouter, Depends

from app.core.security import require_auth
from app.models.schemas import ChatRequest
from app.services.chatbot_service import ask

router = APIRouter(prefix="/chatbot", tags=["chatbot"], dependencies=[Depends(require_auth)])


@router.post("/ask")
def chatbot_ask(payload: ChatRequest):
    return ask(payload.question)
