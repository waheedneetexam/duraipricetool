import json
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status as http_status

from app.core.security import AuthContext, require_auth
from app.api.routes_audit import router as audit_router
from app.services.audit_service import list_audit_logs, log_action
from app.models.schemas import (
    AIPricingTemplateProcessRequest,
    AssignRoleRequest,
    CreateTenantUserRequest,
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
    compute_diff,
    delete_table_record,
    get_table_record,
    get_table_schemas,
    get_table_stats,
    import_table_data,
    list_table_data,
    parse_csv_text,
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

from app.services.platform_service import (
    assign_tenant_user_role,
    create_tenant_user,
    list_available_roles,
    list_tenant_users,
    remove_tenant_user_role,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_auth)])


@router.post("/ingest/csv")
async def ingest_csv(
    file: UploadFile = File(...),
    mapping_json: str = Form(default="{}"),
    context: AuthContext = Depends(require_auth),
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
        result = ingest_csv_chunked(tmp_path, mapping, tenant_id=context.tenant_id)
        return {"status": "success", **result}
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@router.post("/seed/sample-data")
def seed_sample_data(row_count: int = 10000, context: AuthContext = Depends(require_auth)):
    return generate_synthetic_transactions(row_count=row_count, tenant_id=context.tenant_id)


@router.post("/seed/workflow-rules")
def seed_workflow_rules(context: AuthContext = Depends(require_auth)):
    return seed_default_workflow_rules(tenant_id=context.tenant_id)


@router.post("/sync/run-once")
def sync_run_once(context: AuthContext = Depends(require_auth)):
    _require_perm(context, "platform.sync")
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
def post_line_item_config_validate(payload: LineItemColumnConfigSaveRequest, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "admin.manage")
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
    _require_perm(context, "admin.manage")
    try:
        data = process_ai_pricing_template(context.tenant_id, payload.template_text)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/data/table-schemas")
def get_data_table_schemas(context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.read")
    return {"success": True, "data": get_table_schemas()}


@router.get("/tables/{table_name}/columns")
def get_table_columns_endpoint(table_name: str, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.read")
    schemas = get_table_schemas()
    if table_name not in schemas:
        return {"success": False, "error": f"Unknown table '{table_name}'"}
    return {"success": True, "data": schemas[table_name]["fields"]}


@router.post("/tables/{table_name}/upload-csv")
async def post_table_upload_csv(
    table_name: str,
    file: UploadFile = File(...),
    mapping_json: str = Form(default="{}"),
    update_duplicates: str = Form(default="true"),
    context: AuthContext = Depends(require_auth)
):
    _require_perm(context, "master_data.manage")
    
    schemas = get_table_schemas()
    if table_name not in schemas:
        return {"success": False, "error": f"Unknown table '{table_name}'"}
        
    mapping_payload = json.loads(mapping_json or "{}")
    should_update = update_duplicates.lower() == "true"
    
    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    
    try:
        raw_rows = parse_csv_text(text)
        
        # Apply mapping
        mapped_rows = []
        for raw_row in raw_rows:
            mapped_row = {"_rowNumber": raw_row.get("_rowNumber")}
            for table_field, csv_header in mapping_payload.items():
                if csv_header in raw_row:
                    mapped_row[table_field] = raw_row[csv_header]
            mapped_rows.append(mapped_row)
            
        result = import_table_data(table_id=table_name, rows=mapped_rows, tenant_id=context.tenant_id, update_duplicates=should_update)
        
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="master_data",
            target_id=table_name,
            action="upload_csv",
            detail={
                "table": table_name,
                "rows_processed": len(mapped_rows),
                "update_duplicates": should_update,
                "filename": file.filename
            }
        )
        return {"success": True, "data": result}
    except Exception as exc:
        return {"success": False, "error": str(exc)}



@router.get("/data/table/{table_id}")
def get_data_table_rows(
    table_id: str,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "",
    sort_dir: str = "asc",
    context: AuthContext = Depends(require_auth),
):
    _require_perm(context, "master_data.read")
    try:
        return list_table_data(
            table_id=table_id,
            tenant_id=context.tenant_id,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.post("/data/import/{table_id}")
def post_data_import(table_id: str, payload: DataManagementImportRequest, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.manage")
    try:
        data = import_table_data(table_id=table_id, rows=payload.data, tenant_id=context.tenant_id, update_duplicates=payload.update_duplicates)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.post("/data/table/{table_id}")
def post_data_record(table_id: str, payload: DataManagementRecordPayload, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.manage")
    try:
        record_id = str(payload.values.get("id") or payload.values.get("code") or payload.values.get("sku") or "")
        data = save_table_record(table_id=table_id, record_id=record_id, payload=payload.values, tenant_id=context.tenant_id)
        
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="master_data",
            target_id=f"{table_id}:{record_id}",
            action="create_record",
            detail={"table": table_id, "record_id": record_id, "values": payload.values}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.put("/data/table/{table_id}/{record_id}")
def put_data_record(table_id: str, record_id: str, payload: DataManagementRecordPayload, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.manage")
    try:
        # Fetch old record for diffing
        old_record = get_table_record(table_id, record_id, tenant_id=context.tenant_id)
        
        data = save_table_record(table_id=table_id, record_id=record_id, payload=payload.values, tenant_id=context.tenant_id)
        
        # Compute diff
        diff = {}
        if old_record:
            fields = [f.get("name") for f in get_table_schemas().get(table_id, {}).get("fields", [])]
            diff = compute_diff(old_record, data, fields)

        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="master_data",
            target_id=f"{table_id}:{record_id}",
            action="update_record",
            detail={
                "table": table_id, 
                "record_id": record_id, 
                "values": payload.values,
                "diff": diff
            }
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/data/table/{table_id}/{record_id}/changelog")
def get_record_changelog(table_id: str, record_id: str, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.read")
    target_id = f"{table_id}:{record_id}"
    logs = list_audit_logs(tenant_id=context.tenant_id, target_type="master_data", target_id=target_id)
    return {"success": True, "data": logs}


@router.delete("/data/table/{table_id}/{record_id}")
def delete_data_record(table_id: str, record_id: str, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.manage")
    try:
        data = delete_table_record(table_id, record_id, tenant_id=context.tenant_id)
        
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="master_data",
            target_id=f"{table_id}:{record_id}",
            action="delete_record",
            detail={"table": table_id, "record_id": record_id}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.delete("/data/table/{table_id}/bulk-delete")
def delete_data_bulk(table_id: str, payload: DataManagementBulkDeleteRequest, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.manage")
    try:
        data = bulk_delete_table_records(table_id, payload.ids, tenant_id=context.tenant_id)
        
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="master_data",
            target_id=table_id,
            action="bulk_delete",
            detail={"table": table_id, "count": len(payload.ids), "record_ids": payload.ids}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/data/table/{table_id}/stats")
def get_data_table_stats(table_id: str, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "master_data.read")
    try:
        data = get_table_stats(table_id, tenant_id=context.tenant_id)
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


def _require_perm(ctx: AuthContext, perm: str) -> None:
    if "*" not in ctx.permissions and perm not in ctx.permissions:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {perm}")


@router.get("/users")
def get_tenant_users(context: AuthContext = Depends(require_auth)):
    _require_perm(context, "tenant.users.manage")
    return {"success": True, "data": list_tenant_users(context.tenant_id)}


@router.post("/users")
def post_tenant_user(payload: CreateTenantUserRequest, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "tenant.users.manage")
    try:
        data = create_tenant_user(
            tenant_id=context.tenant_id,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role_name=payload.role,
        )
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="user",
            target_id=data["user_id"],
            action="create_tenant_user",
            detail={"email": payload.email, "role": payload.role}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.post("/users/{user_id}/assign-role")
def post_assign_role(user_id: str, payload: AssignRoleRequest, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "tenant.roles.assign")
    try:
        data = assign_tenant_user_role(
            tenant_id=context.tenant_id,
            user_id=user_id,
            role_name=payload.role,
        )
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="user",
            target_id=user_id,
            action="assign_role",
            detail={"role": payload.role}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.delete("/users/{user_id}/role/{role_name}")
def delete_user_role(user_id: str, role_name: str, context: AuthContext = Depends(require_auth)):
    _require_perm(context, "tenant.roles.assign")
    try:
        remove_tenant_user_role(tenant_id=context.tenant_id, user_id=user_id, role_name=role_name)
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="user",
            target_id=user_id,
            action="remove_role",
            detail={"role": role_name}
        )
        return {"success": True}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/roles")
def get_tenant_roles(context: AuthContext = Depends(require_auth)):
    _require_perm(context, "tenant.users.manage")
    return {"success": True, "data": list_available_roles(for_superadmin=False)}
