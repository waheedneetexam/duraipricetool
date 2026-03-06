import json
import re
from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client

DEFAULT_TENANT_ID = "default"


def _tx_on_postgres() -> bool:
    return DB_ENGINE in {"postgres", "hybrid"}


def _normalize_tenant_id(tenant_id: str | None) -> str:
    raw = (tenant_id or "").strip()
    return raw or DEFAULT_TENANT_ID


def _ensure_postgres_tables() -> None:
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS field_logic_rules (
            logic_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            field_key TEXT NOT NULL,
            natural_language_logic TEXT,
            generated_code TEXT,
            explanation TEXT,
            dependencies_json JSONB,
            version INTEGER DEFAULT 1,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS field_logic_validation_runs (
            validation_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            field_key TEXT NOT NULL,
            status TEXT NOT NULL,
            severity TEXT NOT NULL,
            errors_json JSONB,
            warnings_json JSONB,
            generated_code TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_pricing_configurations (
            config_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            template_text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            summary TEXT,
            confidence DOUBLE PRECISION,
            processed_result_json JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _ensure_duckdb_tables() -> None:
    db_client.execute(
        """
        CREATE TABLE IF NOT EXISTS field_logic_rules (
            logic_id VARCHAR PRIMARY KEY,
            tenant_id VARCHAR,
            scope VARCHAR,
            field_key VARCHAR,
            natural_language_logic VARCHAR,
            generated_code VARCHAR,
            explanation VARCHAR,
            dependencies_json JSON,
            version INTEGER DEFAULT 1,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db_client.execute(
        """
        CREATE TABLE IF NOT EXISTS field_logic_validation_runs (
            validation_id VARCHAR PRIMARY KEY,
            tenant_id VARCHAR,
            scope VARCHAR,
            field_key VARCHAR,
            status VARCHAR,
            severity VARCHAR,
            errors_json JSON,
            warnings_json JSON,
            generated_code VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db_client.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_pricing_configurations (
            config_id VARCHAR PRIMARY KEY,
            tenant_id VARCHAR,
            template_text VARCHAR,
            status VARCHAR DEFAULT 'draft',
            summary VARCHAR,
            confidence DOUBLE,
            processed_result_json JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _ensure_tables() -> None:
    if _tx_on_postgres():
        _ensure_postgres_tables()
    else:
        _ensure_duckdb_tables()


def _get_table_columns() -> dict[str, set[str]]:
    if _tx_on_postgres():
        rows = pg_client.execute(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            """
        )
    else:
        rows = db_client.fetch_df("SELECT table_name, column_name FROM information_schema.columns").to_dict(orient="records")

    columns: dict[str, set[str]] = {}
    for row in rows:
        table_name = str(row.get("table_name") or "").strip()
        column_name = str(row.get("column_name") or "").strip()
        if not table_name or not column_name:
            continue
        columns.setdefault(table_name, set()).add(column_name)
    return columns


_PARSER_STOP_WORDS = {"the", "a", "an", "some", "every", "all", "its", "their", "of", "to", "in", "on", "at", "by", "with"}


def _extract_tables(logic_text: str) -> set[str]:
    tables: set[str] = set()
    for match in re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"\s+table', logic_text):
        tables.add(match)
    for match in re.findall(r"\bfrom\s+([A-Za-z_][A-Za-z0-9_]*)\b", logic_text, flags=re.IGNORECASE):
        if match.lower() not in _PARSER_STOP_WORDS:
            tables.add(match)
    return tables


def _extract_quoted_columns(logic_text: str) -> set[str]:
    return set(re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', logic_text))


def validate_field_logic(tenant_id: str | None, scope: str, field_key: str, logic_text: str) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    normalized_scope = (scope or "line_item").strip() or "line_item"
    normalized_field = (field_key or "").strip()
    logic = (logic_text or "").strip()

    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    dependencies: dict[str, list[str]] = {"tables": [], "columns": []}

    if not normalized_field:
        errors.append({"type": "missing_field", "message": "Field key is required"})
    if not logic:
        errors.append({"type": "empty_logic", "message": "Logic text cannot be empty"})

    table_columns = _get_table_columns()
    tables = _extract_tables(logic)
    quoted_tokens = _extract_quoted_columns(logic)
    known_column_names = {column for cols in table_columns.values() for column in cols}

    for table_name in sorted(tables):
        if table_name not in table_columns:
            errors.append(
                {
                    "type": "missing_table",
                    "message": f'Table "{table_name}" does not exist',
                    "suggestion": f'Create or import "{table_name}" from Admin data management',
                }
            )
        else:
            dependencies["tables"].append(table_name)

    unknown_quoted = sorted(token for token in quoted_tokens if token not in tables and token not in known_column_names)
    for token in unknown_quoted:
        warnings.append(
            {
                "type": "unknown_token",
                "message": f'"{token}" not recognized as a current table/column',
                "suggestion": "Verify spelling or add the required table column",
            }
        )
    for token in sorted(token for token in quoted_tokens if token in known_column_names):
        dependencies["columns"].append(token)

    from app.services.ai_service import generate_field_logic
    
    try:
        if not errors:
            ai_res = generate_field_logic(normalized_scope, normalized_field, logic, list(known_column_names))
            generated_code = ai_res["generated_code"]
            for col in ai_res["dependencies"].get("columns", []):
                if col not in dependencies["columns"]:
                    dependencies["columns"].append(col)
        else:
            generated_code = ""
    except Exception as e:
        warnings.append({"type": "ai_generation_error", "message": str(e), "suggestion": "Check AI Provider API keys or prompt"})
        generated_code = ""

    if not errors and not generated_code:
        errors.append({"type": "ai_empty_response", "message": "AI failed to generate a formula. Please try rephrasing your logic description."})

    status = "valid" if not errors else "invalid"
    severity = "error" if errors else ("warning" if warnings else "info")
    validation_id = str(uuid4())

    if _tx_on_postgres():
        pg_client.execute(
            """
            INSERT INTO field_logic_validation_runs (
                validation_id, tenant_id, scope, field_key, status, severity,
                errors_json, warnings_json, generated_code, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, CURRENT_TIMESTAMP)
            """,
            (
                validation_id,
                tenant,
                normalized_scope,
                normalized_field,
                status,
                severity,
                json.dumps(errors),
                json.dumps(warnings),
                generated_code,
            ),
        )
    else:
        db_client.execute(
            """
            INSERT INTO field_logic_validation_runs (
                validation_id, tenant_id, scope, field_key, status, severity,
                errors_json, warnings_json, generated_code, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                validation_id,
                tenant,
                normalized_scope,
                normalized_field,
                status,
                severity,
                json.dumps(errors),
                json.dumps(warnings),
                generated_code,
            ),
        )

    return {
        "validationId": validation_id,
        "status": status,
        "severity": severity,
        "errors": errors,
        "warnings": warnings,
        "dependencies": dependencies,
        "generated_code": generated_code,
    }


def save_field_logic_rule(
    tenant_id: str | None,
    scope: str,
    field_key: str,
    logic_text: str,
    generated_code: str,
    explanation: str,
    dependencies: dict | None = None,
) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    normalized_scope = (scope or "line_item").strip() or "line_item"
    normalized_field = (field_key or "").strip()
    logic = (logic_text or "").strip()
    code = (generated_code or "").strip()
    note = (explanation or "").strip()
    dep = dependencies or {}

    if not normalized_field:
        raise ValueError("field_key is required")
    if not logic:
        raise ValueError("logic_text is required")

    if _tx_on_postgres():
        version_rows = pg_client.execute(
            """
            SELECT COALESCE(MAX(version), 0) AS max_version
            FROM field_logic_rules
            WHERE tenant_id = %s AND scope = %s AND field_key = %s
            """,
            (tenant, normalized_scope, normalized_field),
        )
        next_version = int(version_rows[0]["max_version"] or 0) + 1
        pg_client.execute(
            """
            UPDATE field_logic_rules
            SET active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = %s AND scope = %s AND field_key = %s
            """,
            (tenant, normalized_scope, normalized_field),
        )
        logic_id = str(uuid4())
        pg_client.execute(
            """
            INSERT INTO field_logic_rules (
                logic_id, tenant_id, scope, field_key, natural_language_logic,
                generated_code, explanation, dependencies_json, version, active,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (logic_id, tenant, normalized_scope, normalized_field, logic, code, note, json.dumps(dep), next_version),
        )
    else:
        existing = db_client.fetch_df(
            """
            SELECT COALESCE(MAX(version), 0) AS max_version
            FROM field_logic_rules
            WHERE tenant_id = ? AND scope = ? AND field_key = ?
            """,
            (tenant, normalized_scope, normalized_field),
        ).to_dict(orient="records")
        next_version = int((existing[0] or {}).get("max_version") or 0) + 1
        db_client.execute(
            """
            UPDATE field_logic_rules
            SET active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = ? AND scope = ? AND field_key = ?
            """,
            (tenant, normalized_scope, normalized_field),
        )
        logic_id = str(uuid4())
        db_client.execute(
            """
            INSERT INTO field_logic_rules (
                logic_id, tenant_id, scope, field_key, natural_language_logic,
                generated_code, explanation, dependencies_json, version, active,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (logic_id, tenant, normalized_scope, normalized_field, logic, code, note, json.dumps(dep), next_version),
        )

    return {
        "logicId": logic_id,
        "tenantId": tenant,
        "scope": normalized_scope,
        "fieldKey": normalized_field,
        "version": next_version,
        "active": True,
    }


def list_field_logic_rules(tenant_id: str | None, scope: str | None = None) -> list[dict]:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    scope_filter = (scope or "").strip()

    if _tx_on_postgres():
        if scope_filter:
            rows = pg_client.execute(
                """
                SELECT
                    logic_id AS id, tenant_id, scope, field_key, natural_language_logic,
                    generated_code, explanation, dependencies_json, version, active,
                    created_at, updated_at
                FROM field_logic_rules
                WHERE tenant_id = %s AND scope = %s AND active = TRUE
                ORDER BY updated_at DESC
                """,
                (tenant, scope_filter),
            )
        else:
            rows = pg_client.execute(
                """
                SELECT
                    logic_id AS id, tenant_id, scope, field_key, natural_language_logic,
                    generated_code, explanation, dependencies_json, version, active,
                    created_at, updated_at
                FROM field_logic_rules
                WHERE tenant_id = %s AND active = TRUE
                ORDER BY updated_at DESC
                """,
                (tenant,),
            )
    else:
        if scope_filter:
            rows = db_client.fetch_df(
                """
                SELECT
                    logic_id AS id, tenant_id, scope, field_key, natural_language_logic,
                    generated_code, explanation, dependencies_json, version, active,
                    created_at, updated_at
                FROM field_logic_rules
                WHERE tenant_id = ? AND scope = ? AND active = TRUE
                ORDER BY updated_at DESC
                """,
                (tenant, scope_filter),
            ).to_dict(orient="records")
        else:
            rows = db_client.fetch_df(
                """
                SELECT
                    logic_id AS id, tenant_id, scope, field_key, natural_language_logic,
                    generated_code, explanation, dependencies_json, version, active,
                    created_at, updated_at
                FROM field_logic_rules
                WHERE tenant_id = ? AND active = TRUE
                ORDER BY updated_at DESC
                """,
                (tenant,),
            ).to_dict(orient="records")

    result: list[dict] = []
    for row in rows:
        logic_id = row.get("id") or row.get("logic_id")
        field_key = row.get("field_key") or row.get("fieldKey")
        logic_text = row.get("natural_language_logic") or row.get("logicText") or ""
        generated_code = row.get("generated_code") or row.get("generatedCode") or ""
        dependencies = row.get("dependencies_json") or row.get("dependencies") or {}
        result.append(
            {
                "id": logic_id,
                "logicId": logic_id,
                "tenantId": row.get("tenant_id"),
                "scope": row.get("scope"),
                "field_key": field_key,
                "fieldKey": field_key,
                "natural_language_logic": logic_text,
                "logicText": logic_text,
                "generated_code": generated_code,
                "generatedCode": generated_code,
                "explanation": row.get("explanation") or "",
                "dependencies_json": dependencies,
                "dependencies": dependencies,
                "version": int(row.get("version") or 1),
                "active": bool(row.get("active", True)),
                "createdAt": row.get("created_at"),
                "updatedAt": row.get("updated_at"),
            }
        )
    return result


def process_ai_pricing_template(tenant_id: str | None, template_text: str) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    template = (template_text or "").strip()
    if not template:
        raise ValueError("template_text is required")

    from app.services.ai_service import evaluate_pricing_template
    
    try:
        ai_result = evaluate_pricing_template(template)
        summary = ai_result["summary"]
        confidence = ai_result["confidence"]
        detected = ai_result["sectionsDetected"]
    except Exception as e:
        # Fallback if API key is missing or prompt fails
        summary = f"AI Generation Error: {str(e)}"
        confidence = 0.0
        detected = {
            "headerFields": 0,
            "lineItemFields": 0,
            "pricingRules": 0,
            "tableDependencies": 0,
            "calculationPriorities": 0
        }

    processed_result = {
        "summary": summary,
        "confidence": confidence,
        "sectionsDetected": detected,
        "processedAtUtc": datetime.now(timezone.utc).isoformat(),
    }
    config_id = str(uuid4())

    if _tx_on_postgres():
        pg_client.execute(
            """
            INSERT INTO ai_pricing_configurations (
                config_id, tenant_id, template_text, status, summary,
                confidence, processed_result_json, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (config_id, tenant, template, "processed", summary, confidence, json.dumps(processed_result)),
        )
    else:
        db_client.execute(
            """
            INSERT INTO ai_pricing_configurations (
                config_id, tenant_id, template_text, status, summary,
                confidence, processed_result_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (config_id, tenant, template, "processed", summary, confidence, json.dumps(processed_result)),
        )

    return {
        "configId": config_id,
        "tenantId": tenant,
        "status": "processed",
        "summary": summary,
        "confidence": confidence,
        "processedResult": processed_result,
    }
