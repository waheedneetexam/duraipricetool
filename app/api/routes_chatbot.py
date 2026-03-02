from fastapi import APIRouter

from app.models.schemas import ChatRequest
from app.services.chatbot_service import ask

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.post("/ask")
def chatbot_ask(payload: ChatRequest):
    return ask(payload.question)
