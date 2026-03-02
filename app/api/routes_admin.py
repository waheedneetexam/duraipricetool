import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import CSVColumnMapping, LineItemColumnConfigSaveRequest
from app.services.line_item_config_service import (
    get_line_item_column_config,
    save_line_item_column_config,
)
from app.services.csv_ingestion import ingest_csv_chunked
from app.services.quote_service import seed_default_workflow_rules
from app.services.sample_data_generator import generate_synthetic_transactions
from app.services.sync_service import run_sync_once

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/ingest/csv")
async def ingest_csv(
    file: UploadFile = File(...),
    mapping_json: str = Form(default="{}"),
):
    mapping_payload = json.loads(mapping_json or "{}")
    mapping = CSVColumnMapping(**mapping_payload)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            tmp.write(chunk)
        tmp_path = Path(tmp.name)

    try:
        result = ingest_csv_chunked(tmp_path, mapping)
        return {"status": "success", **result}
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@router.post("/seed/sample-data")
def seed_sample_data(row_count: int = 10000):
    return generate_synthetic_transactions(row_count=row_count)


@router.post("/seed/workflow-rules")
def seed_workflow_rules():
    return seed_default_workflow_rules()


@router.post("/sync/run-once")
def sync_run_once():
    try:
        return run_sync_once()
    except Exception as exc:
        return {"status": "error", "reason": str(exc)}


@router.get("/line-item-config")
def get_line_item_config(tenant_id: str = "default"):
    return {"success": True, "data": get_line_item_column_config(tenant_id)}


@router.put("/line-item-config")
def put_line_item_config(payload: LineItemColumnConfigSaveRequest, tenant_id: str = "default"):
    data = save_line_item_column_config(tenant_id, [col.model_dump() for col in payload.columns])
    return {"success": True, "data": data}
