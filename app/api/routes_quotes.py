from fastapi import APIRouter, Depends

from app.core.security import AuthContext, require_auth
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

router = APIRouter(prefix="/quotes", tags=["quotes"], dependencies=[Depends(require_auth)])


@router.post("/calculate")
def calculate(payload: QuoteCalculationRequest, context: AuthContext = Depends(require_auth)):
    return calculate_quote(payload, tenant_id=context.tenant_id)


@router.post("/workflow/evaluate")
def evaluate(payload: WorkflowEvaluationRequest, context: AuthContext = Depends(require_auth)):
    return evaluate_workflow(payload, tenant_id=context.tenant_id)


@router.get("/list")
def quotes_list(context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": list_quotes(tenant_id=context.tenant_id)}


@router.post("/save")
def save(payload: QuoteSaveRequest, context: AuthContext = Depends(require_auth)):
    return save_quote(payload, tenant_id=context.tenant_id)


@router.get("/{quote_id}")
def get_quote_by_id(quote_id: str, context: AuthContext = Depends(require_auth)):
    quote = get_quote(quote_id, tenant_id=context.tenant_id)
    if quote is None:
        return {"success": False, "error": "Quote not found"}
    return {"success": True, "data": quote}


@router.delete("/{quote_id}")
def delete_quote_by_id(quote_id: str, context: AuthContext = Depends(require_auth)):
    return delete_quote(quote_id, tenant_id=context.tenant_id)
