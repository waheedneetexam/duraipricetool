import json
import re
from typing import Any

from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


DEFAULT_TENANT_ID = "default"
IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
FORMULA_TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
SUPPORTED_FIELD_TYPES = {
    "text",
    "number",
    "currency",
    "percent",
    "date",
    "select",
    "textarea",
    "checkbox",
    "calculated",
}

DEFAULT_COLUMNS = [
    {
        "key": "productName",
        "label": "Product Name",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
        "field_type": "text",
        "default_value": "",
        "width": 220,
        "options": [],
        "validation": {},
        "description": "Product description",
        "category": "core",
    },
    {
        "key": "sku",
        "label": "SKU",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
        "field_type": "text",
        "default_value": "",
        "width": 140,
        "options": [],
        "validation": {},
        "description": "Product SKU",
        "category": "core",
    },
    {
        "key": "quantity",
        "label": "QTY",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
        "field_type": "number",
        "default_value": 1,
        "width": 100,
        "options": [],
        "validation": {"min": 1},
        "description": "Ordered quantity",
        "category": "core",
    },
    {
        "key": "listPrice",
        "label": "List Price",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
        "field_type": "currency",
        "default_value": 0,
        "width": 130,
        "options": [],
        "validation": {"min": 0},
        "description": "List unit price",
        "category": "pricing",
    },
    {
        "key": "cost",
        "label": "Cost",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
        "field_type": "currency",
        "default_value": 0,
        "width": 120,
        "options": [],
        "validation": {"min": 0},
        "description": "Unit cost",
        "category": "pricing",
    },
    {
        "key": "volumeDiscount",
        "label": "Discount %",
        "visible": True,
        "mandatory": False,
        "editable": True,
        "is_calculated": False,
        "formula": "",
        "field_type": "percent",
        "default_value": 0,
        "width": 120,
        "options": [],
        "validation": {"min": 0, "max": 100},
        "description": "Volume discount percentage",
        "category": "pricing",
    },
    {
        "key": "rebate",
        "label": "Rebate",
        "visible": True,
        "mandatory": False,
        "editable": True,
        "is_calculated": False,
        "formula": "",
        "field_type": "currency",
        "default_value": 0,
        "width": 120,
        "options": [],
        "validation": {"min": 0},
        "description": "Line-item rebate",
        "category": "pricing",
    },
    {
        "key": "netPrice",
        "label": "Net Price",
        "visible": True,
        "mandatory": False,
        "editable": False,
        "is_calculated": True,
        "formula": "",
        "field_type": "currency",
        "default_value": 0,
        "width": 130,
        "options": [],
        "validation": {},
        "description": "Calculated net unit price",
        "category": "calculated",
    },
    {
        "key": "margin",
        "label": "Margin %",
        "visible": True,
        "mandatory": False,
        "editable": False,
        "is_calculated": True,
        "formula": "",
        "field_type": "percent",
        "default_value": 0,
        "width": 120,
        "options": [],
        "validation": {},
        "description": "Calculated margin percent",
        "category": "calculated",
    },
    {
        "key": "totalValue",
        "label": "Total Value",
        "visible": True,
        "mandatory": False,
        "editable": False,
        "is_calculated": True,
        "formula": "",
        "field_type": "currency",
        "default_value": 0,
        "width": 140,
        "options": [],
        "validation": {},
        "description": "Calculated line extended value",
        "category": "calculated",
    },
]


def _tx_on_postgres() -> bool:
    return DB_ENGINE in {"postgres", "hybrid"}


def _normalize_tenant_id(tenant_id: str | None) -> str:
    raw = (tenant_id or "").strip()
    return raw or DEFAULT_TENANT_ID


def _column_defaults_by_key() -> dict[str, dict[str, Any]]:
    return {col["key"]: col for col in DEFAULT_COLUMNS}


def _safe_json_load(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return fallback
        try:
            loaded = json.loads(stripped)
            if isinstance(loaded, type(fallback)):
                return loaded
        except Exception:
            return fallback
    return fallback


def _ensure_postgres_table() -> None:
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS line_item_column_configs (
            tenant_id TEXT NOT NULL,
            column_key TEXT NOT NULL,
            column_label TEXT NOT NULL,
            visible BOOLEAN DEFAULT TRUE,
            mandatory BOOLEAN DEFAULT FALSE,
            editable BOOLEAN DEFAULT TRUE,
            is_calculated BOOLEAN DEFAULT FALSE,
            formula TEXT,
            field_type TEXT DEFAULT 'text',
            default_value TEXT,
            width INTEGER,
            options_json JSONB,
            validation_json JSONB,
            description TEXT,
            category TEXT,
            sort_order INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (tenant_id, column_key)
        )
        """
    )
    for stmt in (
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS field_type TEXT DEFAULT 'text'",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS default_value TEXT",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS width INTEGER",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS options_json JSONB",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS validation_json JSONB",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS category TEXT",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS is_calculated BOOLEAN DEFAULT FALSE",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS formula TEXT",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
    ):
        pg_client.execute(stmt)


def _ensure_duckdb_table() -> None:
    db_client.execute(
        """
        CREATE TABLE IF NOT EXISTS line_item_column_configs (
            tenant_id VARCHAR,
            column_key VARCHAR,
            column_label VARCHAR,
            visible BOOLEAN DEFAULT TRUE,
            mandatory BOOLEAN DEFAULT FALSE,
            editable BOOLEAN DEFAULT TRUE,
            is_calculated BOOLEAN DEFAULT FALSE,
            formula VARCHAR,
            field_type VARCHAR DEFAULT 'text',
            default_value VARCHAR,
            width INTEGER,
            options_json JSON,
            validation_json JSON,
            description VARCHAR,
            category VARCHAR,
            sort_order INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    for stmt in (
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS field_type VARCHAR",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS default_value VARCHAR",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS width INTEGER",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS options_json JSON",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS validation_json JSON",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS description VARCHAR",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS category VARCHAR",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS is_calculated BOOLEAN",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS formula VARCHAR",
        "ALTER TABLE line_item_column_configs ADD COLUMN IF NOT EXISTS sort_order INTEGER",
    ):
        try:
            db_client.execute(stmt)
        except Exception:
            # DuckDB extension mode/read-only can block schema mutation; creation covers fresh databases.
            pass


def _row_to_column_config(
    row: dict[str, Any],
    default_col: dict[str, Any] | None,
    fallback_sort_order: int,
) -> dict[str, Any]:
    key = row.get("column_key") or (default_col or {}).get("key")
    default = default_col or {}
    return {
        "key": key,
        "label": row.get("column_label") or default.get("label", key),
        "visible": bool(row.get("visible", default.get("visible", True))),
        "mandatory": bool(row.get("mandatory", default.get("mandatory", False))),
        "editable": bool(row.get("editable", default.get("editable", True))),
        "isCalculated": bool(row.get("is_calculated", default.get("is_calculated", False))),
        "formula": row.get("formula") or default.get("formula", ""),
        "fieldType": row.get("field_type") or default.get("field_type", "text"),
        "defaultValue": (
            row.get("default_value")
            if row.get("default_value") is not None
            else default.get("default_value")
        ),
        "width": row.get("width") if row.get("width") is not None else default.get("width"),
        "options": _safe_json_load(row.get("options_json"), default.get("options", [])),
        "validation": _safe_json_load(row.get("validation_json"), default.get("validation", {})),
        "description": row.get("description") or default.get("description", ""),
        "category": row.get("category") or default.get("category", ""),
        "sortOrder": int(row.get("sort_order") or fallback_sort_order),
    }


def get_line_item_column_config(tenant_id: str | None) -> dict[str, Any]:
    normalized_tenant_id = _normalize_tenant_id(tenant_id)
    defaults_by_key = _column_defaults_by_key()

    rows: list[dict[str, Any]]
    if _tx_on_postgres():
        _ensure_postgres_table()
        rows = pg_client.execute(
            """
            SELECT
                column_key,
                column_label,
                visible,
                mandatory,
                editable,
                is_calculated,
                formula,
                field_type,
                default_value,
                width,
                options_json,
                validation_json,
                description,
                category,
                sort_order
            FROM line_item_column_configs
            WHERE tenant_id = %s
            ORDER BY sort_order ASC
            """,
            (normalized_tenant_id,),
        )
    else:
        _ensure_duckdb_table()
        rows = db_client.fetch_df(
            """
            SELECT
                column_key,
                column_label,
                visible,
                mandatory,
                editable,
                is_calculated,
                formula,
                field_type,
                default_value,
                width,
                options_json,
                validation_json,
                description,
                category,
                sort_order
            FROM line_item_column_configs
            WHERE tenant_id = ?
            ORDER BY sort_order ASC
            """,
            (normalized_tenant_id,),
        ).to_dict(orient="records")

    stored_by_key: dict[str, dict[str, Any]] = {}
    for row in rows:
        column_key = row.get("column_key")
        if not column_key:
            continue
        stored_by_key[column_key] = _row_to_column_config(
            row=row,
            default_col=defaults_by_key.get(column_key),
            fallback_sort_order=int(row.get("sort_order") or 0),
        )

    combined: list[dict[str, Any]] = []
    order_counter = 0
    for default_col in DEFAULT_COLUMNS:
        key = default_col["key"]
        stored = stored_by_key.pop(key, None)
        if stored:
            stored["sortOrder"] = order_counter
            combined.append(stored)
        else:
            combined.append(
                _row_to_column_config(
                    row={"column_key": key},
                    default_col=default_col,
                    fallback_sort_order=order_counter,
                )
            )
        order_counter += 1

    for stored in sorted(stored_by_key.values(), key=lambda item: item["sortOrder"]):
        stored["sortOrder"] = order_counter
        combined.append(stored)
        order_counter += 1

    return {"tenantId": normalized_tenant_id, "columns": combined}


def validate_line_item_column_config(columns: list[dict[str, Any]]) -> dict[str, Any]:
    seen: set[str] = set()
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    keys = [str(col.get("key") or "").strip() for col in columns if str(col.get("key") or "").strip()]
    key_set = set(keys)
    reserved_tokens = {
        "if",
        "else",
        "for",
        "while",
        "return",
        "const",
        "let",
        "var",
        "Math",
        "round",
        "min",
        "max",
    }

    for index, column in enumerate(columns):
        key = str(column.get("key") or "").strip()
        label = str(column.get("label") or "").strip()
        field_type = str(
            column.get("field_type")
            or column.get("fieldType")
            or ("calculated" if bool(column.get("is_calculated") or column.get("isCalculated")) else "text")
        ).strip()
        formula = str(column.get("formula") or "").strip()
        is_calculated = bool(column.get("is_calculated") or column.get("isCalculated"))

        if not key:
            errors.append({"field": f"columns[{index}].key", "message": "Column key is required"})
            continue
        if key in seen:
            errors.append({"field": key, "message": f'Duplicate column key "{key}"'})
        seen.add(key)
        if not IDENTIFIER_RE.match(key):
            errors.append(
                {
                    "field": key,
                    "message": "Column key must be a valid identifier (letters, numbers, underscore; cannot start with number)",
                }
            )
        if not label:
            errors.append({"field": key, "message": "Column label is required"})
        if field_type not in SUPPORTED_FIELD_TYPES:
            errors.append(
                {"field": key, "message": f'Unsupported field type "{field_type}"'}
            )
        if is_calculated and not formula:
            errors.append({"field": key, "message": "Calculated fields require a formula"})
        if formula:
            referenced = {
                token
                for token in FORMULA_TOKEN_RE.findall(formula)
                if token not in reserved_tokens and not token.isupper() and not token.isdigit()
            }
            missing = sorted(token for token in referenced if token not in key_set)
            for token in missing:
                errors.append(
                    {
                        "field": key,
                        "message": f'Formula references missing field "{token}"',
                    }
                )
        width = column.get("width")
        if width is not None:
            try:
                width_val = int(width)
                if width_val < 60:
                    warnings.append(
                        {"field": key, "message": "Column width below 60px may cause readability issues"}
                    )
            except Exception:
                errors.append({"field": key, "message": "Width must be a numeric value"})

    return {
        "isValid": not errors,
        "errors": errors,
        "warnings": warnings,
    }


def _normalize_column_payload(col: dict[str, Any], idx: int, defaults_by_key: dict[str, dict[str, Any]]) -> dict[str, Any]:
    key = str(col.get("key") or "").strip()
    base = defaults_by_key.get(key, {})
    visible = bool(col.get("visible", base.get("visible", True)))
    mandatory = bool(col.get("mandatory", base.get("mandatory", False)))
    editable = bool(col.get("editable", base.get("editable", not bool(col.get("is_calculated")))))
    is_calculated = bool(col.get("is_calculated", col.get("isCalculated", base.get("is_calculated", False))))
    formula = str(col.get("formula", base.get("formula", "")) or "").strip()
    label = str(col.get("label") or base.get("label") or key).strip()
    field_type = str(
        col.get("field_type")
        or col.get("fieldType")
        or base.get("field_type")
        or ("calculated" if is_calculated else "text")
    ).strip()
    default_value = col.get("default_value", col.get("defaultValue", base.get("default_value")))
    width_raw = col.get("width", base.get("width"))
    width = None
    if width_raw not in (None, ""):
        try:
            width = int(width_raw)
        except Exception:
            width = None
    options = _safe_json_load(col.get("options", col.get("options_json", base.get("options", []))), [])
    validation = _safe_json_load(
        col.get("validation", col.get("validation_json", base.get("validation", {}))),
        {},
    )
    description = str(col.get("description", base.get("description", "")) or "").strip()
    category = str(col.get("category", base.get("category", "")) or "").strip()
    return {
        "key": key,
        "label": label,
        "visible": visible,
        "mandatory": mandatory,
        "editable": editable and not is_calculated,
        "is_calculated": is_calculated,
        "formula": formula,
        "field_type": field_type,
        "default_value": None if default_value is None else str(default_value),
        "width": width,
        "options_json": json.dumps(options),
        "validation_json": json.dumps(validation),
        "description": description,
        "category": category,
        "sort_order": idx,
    }


def save_line_item_column_config(tenant_id: str | None, columns: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_tenant_id = _normalize_tenant_id(tenant_id)
    defaults_by_key = _column_defaults_by_key()

    sanitized = []
    for idx, col in enumerate(columns):
        key = str(col.get("key") or "").strip()
        if not key:
            continue
        sanitized.append(_normalize_column_payload(col, idx, defaults_by_key))

    validation_result = validate_line_item_column_config(sanitized)
    if not validation_result["isValid"]:
        raise ValueError(json.dumps(validation_result))

    if _tx_on_postgres():
        _ensure_postgres_table()
        for col in sanitized:
            pg_client.execute(
                """
                INSERT INTO line_item_column_configs (
                    tenant_id, column_key, column_label, visible, mandatory, editable,
                    is_calculated, formula, field_type, default_value, width,
                    options_json, validation_json, description, category, sort_order, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, CURRENT_TIMESTAMP
                )
                ON CONFLICT (tenant_id, column_key) DO UPDATE SET
                    column_label = EXCLUDED.column_label,
                    visible = EXCLUDED.visible,
                    mandatory = EXCLUDED.mandatory,
                    editable = EXCLUDED.editable,
                    is_calculated = EXCLUDED.is_calculated,
                    formula = EXCLUDED.formula,
                    field_type = EXCLUDED.field_type,
                    default_value = EXCLUDED.default_value,
                    width = EXCLUDED.width,
                    options_json = EXCLUDED.options_json,
                    validation_json = EXCLUDED.validation_json,
                    description = EXCLUDED.description,
                    category = EXCLUDED.category,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    normalized_tenant_id,
                    col["key"],
                    col["label"],
                    col["visible"],
                    col["mandatory"],
                    col["editable"],
                    col["is_calculated"],
                    col["formula"],
                    col["field_type"],
                    col["default_value"],
                    col["width"],
                    col["options_json"],
                    col["validation_json"],
                    col["description"],
                    col["category"],
                    col["sort_order"],
                ),
            )
    else:
        _ensure_duckdb_table()
        db_client.execute("DELETE FROM line_item_column_configs WHERE tenant_id = ?", (normalized_tenant_id,))
        for col in sanitized:
            db_client.execute(
                """
                INSERT INTO line_item_column_configs (
                    tenant_id, column_key, column_label, visible, mandatory, editable,
                    is_calculated, formula, field_type, default_value, width,
                    options_json, validation_json, description, category, sort_order, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    normalized_tenant_id,
                    col["key"],
                    col["label"],
                    col["visible"],
                    col["mandatory"],
                    col["editable"],
                    col["is_calculated"],
                    col["formula"],
                    col["field_type"],
                    col["default_value"],
                    col["width"],
                    col["options_json"],
                    col["validation_json"],
                    col["description"],
                    col["category"],
                    col["sort_order"],
                ),
            )

    return get_line_item_column_config(normalized_tenant_id)
