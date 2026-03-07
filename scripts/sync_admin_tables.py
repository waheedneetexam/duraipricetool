"""Synchronize every PostgreSQL table into the Data Management Admin catalog."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.core.config import PG_DSN
from app.data.data_classification import DATA_CLASSIFICATION
from app.db.postgres_client import pg_client
from app.services.data_management_admin_service import (
    TABLE_DEFS,
    get_table_schemas,
    save_dynamic_table_schema,
    save_table_classification,
)


DEFAULT_TENANT = "default"


def slug_to_title(name: str) -> str:
    parts = re.split(r"[_\-]+", name)
    return " ".join(part.capitalize() for part in parts if part)


def map_field_type(column_name: str, data_type: str) -> str:
    lower_name = column_name.lower()
    lower_type = data_type.lower()

    if "email" in lower_name or lower_name.endswith("_email"):
        return "email"
    if lower_type in {
        "smallint",
        "integer",
        "bigint",
        "int",
        "int2",
        "int4",
        "int8",
        "serial",
        "bigserial",
        "oid",
    }:
        return "number"
    if lower_type in {"numeric", "decimal", "real", "double precision", "money"} or any(
        keyword in lower_name for keyword in ("price", "cost", "amount", "total", "discount", "percent")
    ):
        return "currency"
    if lower_type in {"boolean", "bool"}:
        return "boolean"
    if "date" in lower_type or "timestamp" in lower_type or "time" in lower_type:
        return "date"
    return "text"


def fetch_tables() -> Iterable[str]:
    query = """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
    """
    rows = pg_client.execute(query)
    for row in rows:
        yield row["table_name"]


def fetch_columns(table_name: str) -> list[dict[str, str]]:
    query = """
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = %s
    ORDER BY ordinal_position
    """
    return pg_client.execute(query, (table_name,))


def fetch_primary_key(table_name: str) -> str | None:
    query = """
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = %s
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
    LIMIT 1
    """
    rows = pg_client.execute(query, (table_name,))
    return rows[0]["column_name"] if rows else None


def build_schema(table_name: str, columns: list[dict[str, str]]) -> dict:
    primary_key = fetch_primary_key(table_name) or columns[0]["column_name"]
    field_defs = []
    for column in columns:
        field_defs.append(
            {
                "name": column["column_name"],
                "displayName": slug_to_title(column["column_name"]),
                "type": map_field_type(column["column_name"], column["data_type"]),
                "required": column["is_nullable"] == "NO",
                "unique": column["column_name"] == primary_key,
            }
        )
    sample_csv = ",".join([col["column_name"] for col in columns[: min(4, len(columns))]])
    return {
        "id": table_name,
        "name": table_name,
        "displayName": slug_to_title(table_name),
        "description": slug_to_title(table_name),
        "primaryKey": primary_key,
        "requiresValidation": True,
        "fields": field_defs,
        "sampleCsv": sample_csv,
        "isDynamic": True,
    }


def main() -> None:
    print("🛠️  Synchronizing database tables with Data Management Admin...")
    existing = get_table_schemas(tenant_id=DEFAULT_TENANT)
    existing_names = {schema["name"] for schema in existing.values()}
    defined_map = {table: category for category, tables in DATA_CLASSIFICATION.items() for table in tables}
    tables = list(fetch_tables())
    created = 0

    for table_name in tables:
        if table_name in existing_names:
            continue
        columns = fetch_columns(table_name)
        if not columns:
            continue
        schema = build_schema(table_name, columns)
        try:
            save_dynamic_table_schema(schema, tenant_id=DEFAULT_TENANT)
            created += 1
            print(f"  • Registered {table_name}")
        except Exception as exc:
            print(f"  ! Failed to register {table_name}: {exc}")

    classification_updates = 0
    for table_name in tables:
        category = defined_map.get(table_name, "transactional_data")
        try:
            save_table_classification(table_name, category, tenant_id=DEFAULT_TENANT)
            classification_updates += 1
        except Exception as exc:
            print(f"  ! Failed to classify {table_name}: {exc}")

    print(f"✅ Synced {created} new table schemas.")
    print(f"✅ Recorded classification for {classification_updates} tables.")


if __name__ == "__main__":
    main()
