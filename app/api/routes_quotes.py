from fastapi import APIRouter

from app.models.schemas import (
    QuoteCalculationRequest,
    QuoteSaveRequest,
    WorkflowEvaluationRequest,
)
from app.services.quote_service import (
    calculate_quote,
    delete_quote,
    evaluate_workflow,
    get_quote,
    list_quotes,
    save_quote,
)

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.post("/calculate")
def calculate(payload: QuoteCalculationRequest):
    return calculate_quote(payload)


@router.post("/workflow/evaluate")
def evaluate(payload: WorkflowEvaluationRequest):
    return evaluate_workflow(payload)


@router.get("/list")
def quotes_list():
    return {"success": True, "data": list_quotes()}


@router.post("/save")
def save(payload: QuoteSaveRequest):
    return save_quote(payload)


@router.get("/{quote_id}")
def get_quote_by_id(quote_id: str):
    quote = get_quote(quote_id)
    if quote is None:
        return {"success": False, "error": "Quote not found"}
    return {"success": True, "data": quote}


@router.delete("/{quote_id}")
def delete_quote_by_id(quote_id: str):
    return delete_quote(quote_id)
