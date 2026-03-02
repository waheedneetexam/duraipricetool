from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


DEFAULT_TENANT_ID = "default"

DEFAULT_COLUMNS = [
    {
        "key": "productName",
        "label": "Product Name",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
    },
    {
        "key": "sku",
        "label": "SKU",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
    },
    {
        "key": "quantity",
        "label": "QTY",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
    },
    {
        "key": "listPrice",
        "label": "List Price",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
    },
    {
        "key": "cost",
        "label": "Cost",
        "visible": True,
        "mandatory": True,
        "editable": True,
        "is_calculated": False,
        "formula": "",
    },
    {
        "key": "volumeDiscount",
        "label": "Discount %",
        "visible": True,
        "mandatory": False,
        "editable": True,
        "is_calculated": False,
        "formula": "",
    },
    {
        "key": "rebate",
        "label": "Rebate",
        "visible": True,
        "mandatory": False,
        "editable": True,
        "is_calculated": False,
        "formula": "",
    },
    {
        "key": "netPrice",
        "label": "Net Price",
        "visible": True,
        "mandatory": False,
        "editable": False,
        "is_calculated": True,
        "formula": "",
    },
    {
        "key": "margin",
        "label": "Margin %",
        "visible": True,
        "mandatory": False,
        "editable": False,
        "is_calculated": True,
        "formula": "",
    },
    {
        "key": "totalValue",
        "label": "Total Value",
        "visible": True,
        "mandatory": False,
        "editable": False,
        "is_calculated": True,
        "formula": "",
    },
]


def _tx_on_postgres() -> bool:
    return DB_ENGINE in {"postgres", "hybrid"}


def _normalize_tenant_id(tenant_id: str | None) -> str:
    raw = (tenant_id or "").strip()
    return raw or DEFAULT_TENANT_ID


def _column_defaults_by_key() -> dict[str, dict]:
    return {col["key"]: col for col in DEFAULT_COLUMNS}


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
            sort_order INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (tenant_id, column_key)
        )
        """
    )


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
            sort_order INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def get_line_item_column_config(tenant_id: str | None) -> dict:
    normalized_tenant_id = _normalize_tenant_id(tenant_id)
    defaults_by_key = _column_defaults_by_key()

    rows: list[dict]
    if _tx_on_postgres():
        _ensure_postgres_table()
        rows = pg_client.execute(
            """
            SELECT
                column_key,
                visible,
                mandatory,
                editable
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
                visible,
                mandatory,
                editable
            FROM line_item_column_configs
            WHERE tenant_id = ?
            ORDER BY sort_order ASC
            """,
            (normalized_tenant_id,),
        ).to_dict(orient="records")

    stored_by_key: dict[str, dict] = {}
    for row in rows:
        column_key = row.get("column_key")
        if not column_key:
            continue
        stored_by_key[column_key] = {
            "key": column_key,
            "label": row.get("column_label") or defaults_by_key.get(column_key, {}).get("label", column_key),
            "visible": bool(row.get("visible", True)),
            "mandatory": bool(row.get("mandatory", False)),
            "editable": bool(row.get("editable", True)),
            "is_calculated": bool(row.get("is_calculated", False)),
            "formula": row.get("formula") or "",
            "sortOrder": row.get("sort_order") or 0,
        }

    combined: list[dict] = []
    order_counter = 0
    for default_col in DEFAULT_COLUMNS:
        key = default_col["key"]
        stored = stored_by_key.pop(key, None)
        combined.append(
            {
                "key": key,
                "label": stored["label"] if stored else default_col["label"],
                "visible": stored["visible"] if stored else default_col["visible"],
                "mandatory": stored["mandatory"] if stored else default_col["mandatory"],
                "editable": stored["editable"] if stored else default_col["editable"],
                "is_calculated": stored["is_calculated"] if stored else default_col["is_calculated"],
                "formula": stored["formula"] if stored else default_col["formula"],
                "sortOrder": order_counter,
            }
        )
        order_counter += 1

    # append remaining stored columns not in defaults
    remaining = sorted(stored_by_key.values(), key=lambda x: x["sortOrder"])
    for stored in remaining:
        combined.append(
            {
                "key": stored["key"],
                "label": stored["label"],
                "visible": stored["visible"],
                "mandatory": stored["mandatory"],
                "editable": stored["editable"],
                "is_calculated": stored["is_calculated"],
                "formula": stored["formula"],
                "sortOrder": order_counter,
            }
        )
        order_counter += 1

    return {"tenantId": normalized_tenant_id, "columns": combined}


def save_line_item_column_config(tenant_id: str | None, columns: list[dict]) -> dict:
    normalized_tenant_id = _normalize_tenant_id(tenant_id)
    defaults_by_key = _column_defaults_by_key()

    sanitized = []
    for idx, col in enumerate(columns):
        key = col.get("key")
        if not key:
            continue
        base = defaults_by_key.get(key, {})
        visible = bool(col.get("visible", base.get("visible", True)))
        mandatory = bool(col.get("mandatory", base.get("mandatory", False)))
        editable = bool(col.get("editable", base.get("editable", False)))
        is_calculated = bool(col.get("is_calculated", base.get("is_calculated", False)))
        formula = col.get("formula", base.get("formula", "")) or ""
        label = col.get("label") or base.get("label") or key
        sanitized.append(
            {
                "key": key,
                "label": label,
                "visible": visible,
                "mandatory": mandatory,
                "editable": editable,
                "is_calculated": is_calculated,
                "formula": formula,
                "sort_order": idx,
            }
        )

    if _tx_on_postgres():
        _ensure_postgres_table()
        for col in sanitized:
            pg_client.execute(
                """
                INSERT INTO line_item_column_configs (
                    tenant_id, column_key, column_label, visible, mandatory, editable,
                    is_calculated, formula, sort_order, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (tenant_id, column_key) DO UPDATE SET
                    column_label = EXCLUDED.column_label,
                    visible = EXCLUDED.visible,
                    mandatory = EXCLUDED.mandatory,
                    editable = EXCLUDED.editable,
                    is_calculated = EXCLUDED.is_calculated,
                    formula = EXCLUDED.formula,
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
                    is_calculated, formula, sort_order, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
                    col["sort_order"],
                ),
            )

    return get_line_item_column_config(normalized_tenant_id)
