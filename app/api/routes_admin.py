import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.security import AuthContext, require_auth
from app.models.schemas import (
    AIPricingTemplateProcessRequest,
    CSVColumnMapping,
    DataManagementBulkDeleteRequest,
    DataManagementImportRequest,
    DataManagementRecordPayload,
    FieldLogicSaveRequest,
    FieldLogicValidateRequest,
    LineItemColumnConfigSaveRequest,
)
from app.services.admin_config_service import (
    list_field_logic_rules,
    process_ai_pricing_template,
    save_field_logic_rule,
    validate_field_logic,
)
from app.services.data_management_admin_service import (
    bulk_delete_table_records,
    delete_table_record,
    get_table_schemas,
    get_table_stats,
    import_table_data,
    list_table_data,
    save_table_record,
)
from app.services.line_item_config_service import (
    get_line_item_column_config,
    save_line_item_column_config,
    validate_line_item_column_config,
)
from app.services.csv_ingestion import ingest_csv_chunked
from app.services.quote_service import seed_default_workflow_rules
from app.services.sample_data_generator import generate_synthetic_transactions
from app.services.sync_service import run_sync_once

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_auth)])


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
def seed_workflow_rules(context: AuthContext = Depends(require_auth)):
    return seed_default_workflow_rules(tenant_id=context.tenant_id)


@router.post("/sync/run-once")
def sync_run_once():
    try:
        return run_sync_once()
    except Exception as exc:
        return {"status": "error", "reason": str(exc)}


@router.get("/line-item-config")
def get_line_item_config(context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": get_line_item_column_config(context.tenant_id)}


@router.put("/line-item-config")
def put_line_item_config(payload: LineItemColumnConfigSaveRequest, context: AuthContext = Depends(require_auth)):
    try:
        data = save_line_item_column_config(context.tenant_id, [col.model_dump() for col in payload.columns])
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.post("/line-item-config/validate")
def post_line_item_config_validate(payload: LineItemColumnConfigSaveRequest):
    return {"success": True, "data": validate_line_item_column_config([col.model_dump() for col in payload.columns])}


@router.post("/field-logic/validate")
def post_field_logic_validate(payload: FieldLogicValidateRequest, context: AuthContext = Depends(require_auth)):
    data = validate_field_logic(context.tenant_id, payload.scope, payload.field_key, payload.logic_text)
    return {"success": True, "data": data}


@router.post("/field-logic/save")
def post_field_logic_save(payload: FieldLogicSaveRequest, context: AuthContext = Depends(require_auth)):
    try:
        data = save_field_logic_rule(
            tenant_id=context.tenant_id,
            scope=payload.scope,
            field_key=payload.field_key,
            logic_text=payload.logic_text,
            generated_code=payload.generated_code,
            explanation=payload.explanation,
            dependencies=payload.dependencies,
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/field-logic/list")
def get_field_logic_list(scope: str = "", context: AuthContext = Depends(require_auth)):
    data = list_field_logic_rules(tenant_id=context.tenant_id, scope=scope or None)
    return {"success": True, "data": data}


@router.post("/ai-pricing/process-template")
def post_ai_pricing_process_template(payload: AIPricingTemplateProcessRequest, context: AuthContext = Depends(require_auth)):
    try:
        data = process_ai_pricing_template(context.tenant_id, payload.template_text)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/data/table-schemas")
def get_data_table_schemas():
    return {"success": True, "data": get_table_schemas()}


@router.get("/data/table/{table_id}")
def get_data_table_rows(
    table_id: str,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "",
    sort_dir: str = "asc",
):
    try:
        return list_table_data(
            table_id=table_id,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.post("/data/import/{table_id}")
def post_data_import(table_id: str, payload: DataManagementImportRequest):
    try:
        data = import_table_data(table_id=table_id, rows=payload.data, update_duplicates=payload.update_duplicates)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.post("/data/table/{table_id}")
def post_data_record(table_id: str, payload: DataManagementRecordPayload):
    try:
        record_id = str(payload.values.get("id") or payload.values.get("code") or payload.values.get("sku") or "")
        data = save_table_record(table_id=table_id, record_id=record_id, payload=payload.values)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.put("/data/table/{table_id}/{record_id}")
def put_data_record(table_id: str, record_id: str, payload: DataManagementRecordPayload):
    try:
        data = save_table_record(table_id=table_id, record_id=record_id, payload=payload.values)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.delete("/data/table/{table_id}/{record_id}")
def delete_data_record(table_id: str, record_id: str):
    try:
        data = delete_table_record(table_id, record_id)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.delete("/data/table/{table_id}/bulk-delete")
def delete_data_bulk(table_id: str, payload: DataManagementBulkDeleteRequest):
    try:
        data = bulk_delete_table_records(table_id, payload.ids)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/data/table/{table_id}/stats")
def get_data_table_stats(table_id: str):
    try:
        data = get_table_stats(table_id)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}
