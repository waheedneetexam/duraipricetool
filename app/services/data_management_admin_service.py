import csv
import io
import math
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


def _tx_on_postgres() -> bool:
    return DB_ENGINE in {"postgres", "hybrid"}


@dataclass(frozen=True)
class FieldDef:
    name: str
    type: str = "text"
    required: bool = False
    unique: bool = False
    enum: tuple[str, ...] = ()
    min_value: float | None = None
    max_value: float | None = None
    pattern: str | None = None
    description: str = ""


@dataclass(frozen=True)
class TableDef:
    id: str
    table_name: str
    display_name: str
    primary_key: str
    fields: tuple[FieldDef, ...]
    sample_csv: str
    parent_tables: tuple[str, ...] = ()
    requires_validation: bool = True


EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
BOOL_TRUE = {"true", "1", "yes", "y"}
BOOL_FALSE = {"false", "0", "no", "n"}


TABLE_DEFS: dict[str, TableDef] = {
    "product-hierarchies": TableDef(
        id="product-hierarchies",
        table_name="product_hierarchies",
        display_name="Product Hierarchies",
        primary_key="id",
        fields=(
            FieldDef("id", required=True, unique=True),
            FieldDef("name", required=True),
            FieldDef("description"),
            FieldDef("parent_id"),
            FieldDef("level", type="number"),
        ),
        sample_csv="id,name,description,parent_id,level\nsoftware,Software Solutions,Enterprise software products,,1",
        requires_validation=False,
    ),
    "customers": TableDef(
        id="customers",
        table_name="customers",
        display_name="Customers",
        primary_key="customer_id",
        fields=(
            FieldDef("customer_id", required=True, unique=True),
            FieldDef("name", required=True),
            FieldDef("segment", required=True, enum=("Enterprise", "Mid-Market", "SMB", "Startup")),
            FieldDef("region", required=True),
            FieldDef("country", required=True),
            FieldDef("email", type="email", pattern=EMAIL_PATTERN),
            FieldDef("credit_limit", type="currency", min_value=0),
            FieldDef("account_number"),
            FieldDef("industry"),
            FieldDef("active", type="boolean"),
        ),
        sample_csv="customer_id,name,segment,region,country,email,credit_limit\nacme-corp,Acme Corporation,Enterprise,North America,US,contact@acme.com,1000000",
    ),
    "sales-orgs": TableDef(
        id="sales-orgs",
        table_name="sales_orgs",
        display_name="Sales Organizations",
        primary_key="id",
        fields=(
            FieldDef("id", required=True, unique=True),
            FieldDef("name", required=True),
            FieldDef("region", required=True),
            FieldDef("manager"),
            FieldDef("manager_email", type="email", pattern=EMAIL_PATTERN),
        ),
        sample_csv="id,name,region,manager,manager_email\nus-east,US East Sales,North America,John Smith,john.smith@company.com",
        requires_validation=False,
    ),
    "regions": TableDef(
        id="regions",
        table_name="regions",
        display_name="Regions",
        primary_key="id",
        fields=(
            FieldDef("id", required=True, unique=True),
            FieldDef("name", required=True),
            FieldDef("countries"),
            FieldDef("currency"),
            FieldDef("timezone"),
        ),
        sample_csv="id,name,countries,currency,timezone\nnorth-america,North America,\"US,CA,MX\",USD,America/New_York",
        requires_validation=False,
    ),
    "currencies": TableDef(
        id="currencies",
        table_name="currencies",
        display_name="Currencies",
        primary_key="code",
        fields=(
            FieldDef("code", required=True, unique=True),
            FieldDef("name", required=True),
            FieldDef("symbol", required=True),
            FieldDef("exchange_rate", type="number", required=True),
            FieldDef("decimal_places", type="number"),
        ),
        sample_csv="code,name,symbol,exchange_rate,decimal_places\nUSD,US Dollar,$,1.00,2",
        requires_validation=False,
    ),
    "products": TableDef(
        id="products",
        table_name="products",
        display_name="Products",
        primary_key="sku",
        fields=(
            FieldDef("sku", required=True, unique=True),
            FieldDef("name", required=True),
            FieldDef("description"),
            FieldDef("category", required=True),
            FieldDef("price", type="currency", required=True, min_value=0),
            FieldDef("cost", type="currency", min_value=0),
            FieldDef("unit_of_measure"),
            FieldDef("active", type="boolean"),
            FieldDef("family"),
            FieldDef("product_id"),
        ),
        sample_csv="sku,name,description,category,price,cost,unit_of_measure,active\nSW-001,Enterprise Software Suite,Complete package,software,50000,25000,EA,true",
        parent_tables=("product_hierarchies",),
    ),
    "product-costs": TableDef(
        id="product-costs",
        table_name="product_costs",
        display_name="Product Costs",
        primary_key="id",
        fields=(
            FieldDef("id", required=True, unique=True),
            FieldDef("product_sku", required=True),
            FieldDef("region_id", required=True),
            FieldDef("cost", type="currency", required=True, min_value=0),
            FieldDef("effective_date", type="date", required=True),
            FieldDef("end_date", type="date"),
        ),
        sample_csv="id,product_sku,region_id,cost,effective_date,end_date\ncost-001,SW-001,north-america,25000,2024-01-01,",
        parent_tables=("products", "regions"),
    ),
    "discount-tiers": TableDef(
        id="discount-tiers",
        table_name="discount_tiers",
        display_name="Discount Tiers",
        primary_key="id",
        fields=(
            FieldDef("id", required=True, unique=True),
            FieldDef("tier_name", required=True),
            FieldDef("min_quantity", type="number", required=True, min_value=0),
            FieldDef("max_quantity", type="number"),
            FieldDef("discount_percent", type="number", required=True, min_value=0, max_value=100),
            FieldDef("product_category"),
        ),
        sample_csv="id,tier_name,min_quantity,max_quantity,discount_percent,product_category\ntier-1,Bronze,1,9,0,",
        requires_validation=False,
    ),
    "pricing-rules": TableDef(
        id="pricing-rules",
        table_name="pricing_rules",
        display_name="Pricing Rules",
        primary_key="id",
        fields=(
            FieldDef("id", required=True, unique=True),
            FieldDef("rule_name", required=True),
            FieldDef("description"),
            FieldDef("customer_type"),
            FieldDef("product_category"),
            FieldDef("discount_percent", type="number", min_value=0, max_value=100),
            FieldDef("price_multiplier", type="number", min_value=0),
            FieldDef("priority", type="number"),
            FieldDef("active", type="boolean"),
        ),
        sample_csv="id,rule_name,description,customer_type,product_category,discount_percent,price_multiplier,priority,active\nrule-001,Enterprise Discount,Standard enterprise discount,Enterprise,,15,,1,true",
    ),
    "brands": TableDef(
        id="brands",
        table_name="brands",
        display_name="Product Brands",
        primary_key="brand_code",
        fields=(
            FieldDef("brand_code", required=True, unique=True),
            FieldDef("brand_name", required=True),
            FieldDef("description"),
            FieldDef("origin_country"),
            FieldDef("active", type="boolean"),
        ),
        sample_csv="brand_code,brand_name,description,origin_country,active\nB001,Nike,Sportswear,USA,true",
        requires_validation=True,
    ),
}


def _sql_placeholder() -> str:
    return "%s" if _tx_on_postgres() else "?"


def _execute(query: str, params: tuple | list | None = None) -> list[dict[str, Any]]:
    if _tx_on_postgres():
        return [dict(r) for r in pg_client.execute(query, params)]
    if params is None:
        return db_client.fetch_df(query).to_dict(orient="records")
    return db_client.fetch_df(query, tuple(params)).to_dict(orient="records")


def _ensure_tables() -> None:
    if _tx_on_postgres():
        pg_client.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC")
        pg_client.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure TEXT")
        pg_client.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS country TEXT")
        pg_client.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT")
        pg_client.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC")
    else:
        for stmt in (
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS cost DECIMAL",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR",
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL",
        ):
            try:
                db_client.execute(stmt)
            except Exception:
                pass

    statements = [
        """
        CREATE TABLE IF NOT EXISTS product_hierarchies (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, parent_id TEXT, level INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS sales_orgs (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL, manager TEXT, manager_email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS regions (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, countries TEXT, currency TEXT, timezone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS currencies (
            code TEXT PRIMARY KEY, name TEXT NOT NULL, symbol TEXT NOT NULL, exchange_rate DOUBLE PRECISION NOT NULL, decimal_places INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS product_costs (
            id TEXT PRIMARY KEY, product_sku TEXT NOT NULL, region_id TEXT NOT NULL, cost DOUBLE PRECISION NOT NULL,
            effective_date DATE NOT NULL, end_date DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS discount_tiers (
            id TEXT PRIMARY KEY, tier_name TEXT NOT NULL, min_quantity INTEGER NOT NULL, max_quantity INTEGER, discount_percent DOUBLE PRECISION NOT NULL,
            product_category TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS pricing_rules (
            id TEXT PRIMARY KEY, rule_name TEXT NOT NULL, description TEXT, customer_type TEXT, product_category TEXT, discount_percent DOUBLE PRECISION,
            price_multiplier DOUBLE PRECISION, priority INTEGER, active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS brands (
            brand_code TEXT PRIMARY KEY, 
            brand_name TEXT NOT NULL, 
            description TEXT, 
            origin_country TEXT, 
            active BOOLEAN DEFAULT TRUE,
            tenant_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ]
    for stmt in statements:
        if _tx_on_postgres():
            pg_client.execute(stmt)
        else:
            db_client.execute(stmt)


def _table_def(table_id: str) -> TableDef:
    if table_id not in TABLE_DEFS:
        raise ValueError(f"Unknown table '{table_id}'")
    return TABLE_DEFS[table_id]


def _normalize_value(field: FieldDef, raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = raw.strip()
        if raw == "":
            return None
    if field.type in {"number", "currency"}:
        if raw is None:
            return None
        return float(raw)
    if field.type == "boolean":
        if isinstance(raw, bool):
            return raw
        low = str(raw).strip().lower()
        if low in BOOL_TRUE:
            return True
        if low in BOOL_FALSE:
            return False
        raise ValueError(f"{field.name} must be true/false or yes/no")
    if field.type == "date":
        if raw is None:
            return None
        datetime.fromisoformat(str(raw))
        return str(raw)
    if field.type == "email":
        if raw is None:
            return None
        if not re.match(EMAIL_PATTERN, str(raw)):
            raise ValueError(f"{field.name} must be a valid email")
        return str(raw)
    return str(raw) if raw is not None else None


def _validate_row(record: dict[str, Any], table: TableDef, row_number: int | None = None) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    for field in table.fields:
        value = record.get(field.name)
        if field.required and (value is None or str(value).strip() == ""):
            errors.append({"row": row_number, "field": field.name, "message": f"{field.name} is required", "severity": "error"})
            continue
        if value is None or str(value).strip() == "":
            continue
        try:
            parsed = _normalize_value(field, value)
        except Exception as exc:
            errors.append({"row": row_number, "field": field.name, "value": value, "message": str(exc), "severity": "error"})
            continue
        if parsed is not None and field.enum and str(parsed) not in field.enum:
            errors.append({"row": row_number, "field": field.name, "value": value, "message": f"Value must be one of: {', '.join(field.enum)}", "severity": "error"})
        if parsed is not None and field.min_value is not None:
            try:
                if float(parsed) < float(field.min_value):
                    errors.append({"row": row_number, "field": field.name, "value": value, "message": f"Value must be at least {field.min_value}", "severity": "error"})
            except Exception:
                pass
        if parsed is not None and field.max_value is not None:
            try:
                if float(parsed) > float(field.max_value):
                    errors.append({"row": row_number, "field": field.name, "value": value, "message": f"Value must be at most {field.max_value}", "severity": "error"})
            except Exception:
                pass
        if parsed is not None and field.pattern and not re.match(field.pattern, str(parsed)):
            errors.append({"row": row_number, "field": field.name, "value": value, "message": f"{field.name} format is invalid", "severity": "error"})
    return errors


def _validate_references(record: dict[str, Any], table: TableDef, row_number: int | None = None) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    if table.table_name == "products":
        category = (record.get("category") or "").strip()
        if category:
            ph = _execute(f"SELECT id FROM product_hierarchies WHERE id = {_sql_placeholder()} LIMIT 1", (category,))
            if not ph:
                errors.append({"row": row_number, "field": "category", "value": category, "message": f"Referenced product_hierarchies '{category}' does not exist", "severity": "error"})
    elif table.table_name == "product_costs":
        sku = (record.get("product_sku") or "").strip()
        region_id = (record.get("region_id") or "").strip()
        if sku:
            exists = _execute(f"SELECT sku FROM products WHERE sku = {_sql_placeholder()} LIMIT 1", (sku,))
            if not exists:
                errors.append({"row": row_number, "field": "product_sku", "value": sku, "message": f"Referenced products SKU '{sku}' does not exist", "severity": "error"})
        if region_id:
            exists = _execute(f"SELECT id FROM regions WHERE id = {_sql_placeholder()} LIMIT 1", (region_id,))
            if not exists:
                errors.append({"row": row_number, "field": "region_id", "value": region_id, "message": f"Referenced regions '{region_id}' does not exist", "severity": "error"})
    return errors


def get_table_schemas() -> dict[str, Any]:
    _ensure_tables()
    out: dict[str, Any] = {}
    for table_id, table in TABLE_DEFS.items():
        out[table_id] = {
            "id": table.id,
            "name": table.table_name,
            "displayName": table.display_name,
            "primaryKey": table.primary_key,
            "description": table.display_name,
            "requiresValidation": table.requires_validation,
            "parentTables": list(table.parent_tables),
            "fields": [
                {
                    "name": f.name,
                    "displayName": f.name.replace("_", " ").title(),
                    "type": f.type,
                    "required": f.required,
                    "unique": f.unique,
                }
                for f in table.fields
            ],
            "sampleCsv": table.sample_csv,
        }
    return out


def parse_csv_text(content: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content))
    rows = []
    for idx, row in enumerate(reader):
        normalized = {str(k).strip(): (v if v is not None else "") for k, v in row.items() if k is not None}
        normalized["_rowNumber"] = idx + 2
        rows.append(normalized)
    return rows


def import_table_data(table_id: str, rows: list[dict[str, Any]], tenant_id: str, update_duplicates: bool = True) -> dict[str, Any]:
    _ensure_tables()
    table = _table_def(table_id)
    imported = 0
    updated = 0
    skipped = 0
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for idx, raw in enumerate(rows):
        row_number = int(raw.get("_rowNumber") or (idx + 2))
        clean: dict[str, Any] = {}
        for field in table.fields:
            clean[field.name] = raw.get(field.name)

        row_errors = _validate_row(clean, table, row_number=row_number)
        row_errors.extend(_validate_references(clean, table, row_number=row_number))
        if row_errors:
            errors.extend(row_errors)
            skipped += 1
            continue

        normalized: dict[str, Any] = {}
        for field in table.fields:
            try:
                normalized[field.name] = _normalize_value(field, clean.get(field.name))
            except Exception:
                normalized[field.name] = clean.get(field.name)

        pk = normalized.get(table.primary_key)
        if pk is None or str(pk).strip() == "":
            errors.append({"row": row_number, "field": table.primary_key, "message": "Primary key is required", "severity": "error"})
            skipped += 1
            continue

        exists = _execute(
            f"SELECT {table.primary_key} FROM {table.table_name} WHERE {table.primary_key} = {_sql_placeholder()} AND tenant_id = {_sql_placeholder()} LIMIT 1",
            (pk, tenant_id),
        )
        if exists and not update_duplicates:
            skipped += 1
            warnings.append({"row": row_number, "field": table.primary_key, "message": f"Duplicate {pk} skipped"})
            continue

        save_table_record(table_id, str(pk), normalized, tenant_id=tenant_id, allow_missing_pk=True)
        if exists:
            updated += 1
        else:
            imported += 1

    return {
        "success": len(errors) == 0,
        "recordsProcessed": len(rows),
        "recordsImported": imported,
        "recordsUpdated": updated,
        "recordsSkipped": skipped,
        "errors": errors,
        "warnings": warnings,
    }


def list_table_data(
    table_id: str,
    tenant_id: str,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "",
    sort_dir: str = "asc",
) -> dict[str, Any]:
    _ensure_tables()
    table = _table_def(table_id)
    field_names = [f.name for f in table.fields]
    select_cols = ", ".join(field_names)
    rows = _execute(f"SELECT {select_cols} FROM {table.table_name} WHERE tenant_id = {_sql_placeholder()}", (tenant_id,))

    if search.strip():
        needle = search.strip().lower()
        rows = [
            row
            for row in rows
            if any(needle in str(row.get(field) or "").lower() for field in field_names)
        ]

    if sort_by and sort_by in field_names:
        reverse = sort_dir.lower() == "desc"
        rows.sort(key=lambda r: (r.get(sort_by) is None, str(r.get(sort_by) or "")), reverse=reverse)

    total = len(rows)
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 50
    start = (page - 1) * page_size
    end = start + page_size
    paged = rows[start:end]

    return {
        "success": True,
        "data": paged,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": max(1, math.ceil(total / page_size)),
        },
    }


def get_table_record(table_id: str, record_id: str, tenant_id: str) -> dict[str, Any] | None:
    _ensure_tables()
    table = _table_def(table_id)
    rows = _execute(
        f"SELECT * FROM {table.table_name} WHERE {table.primary_key} = {_sql_placeholder()} AND tenant_id = {_sql_placeholder()} LIMIT 1",
        (record_id, tenant_id),
    )
    return rows[0] if rows else None


def compute_diff(old_vals: dict[str, Any], new_vals: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    diff = {}
    for f in fields:
        ov = old_vals.get(f)
        nv = new_vals.get(f)
        if str(ov) != str(nv):
            diff[f] = [ov, nv]
    return diff


def save_table_record(table_id: str, record_id: str, payload: dict[str, Any], tenant_id: str, allow_missing_pk: bool = False) -> dict[str, Any]:
    _ensure_tables()
    table = _table_def(table_id)
    normalized: dict[str, Any] = {}
    for field in table.fields:
        raw = payload.get(field.name)
        normalized[field.name] = _normalize_value(field, raw) if raw is not None else None

    if not allow_missing_pk:
        normalized[table.primary_key] = record_id
    normalized["tenant_id"] = tenant_id
    pk = normalized.get(table.primary_key)
    if pk is None or str(pk).strip() == "":
        raise ValueError("Primary key value is required")

    errs = _validate_row(normalized, table)
    errs.extend(_validate_references(normalized, table))
    if errs:
        raise ValueError(str(errs))

    cols = [f.name for f in table.fields] + ["tenant_id"]
    values = [normalized.get(col) for col in cols]
    placeholders = ", ".join([_sql_placeholder()] * len(cols))
    col_list = ", ".join(cols)

    if _tx_on_postgres():
        updates = ", ".join([f"{c}=EXCLUDED.{c}" for c in cols if c != table.primary_key])
        pg_client.execute(
            f"""
            INSERT INTO {table.table_name} ({col_list}, updated_at)
            VALUES ({placeholders}, CURRENT_TIMESTAMP)
            ON CONFLICT ({table.primary_key}) DO UPDATE SET
                {updates},
                updated_at = CURRENT_TIMESTAMP
            """,
            tuple(values),
        )
    else:
        db_client.execute(f"DELETE FROM {table.table_name} WHERE {table.primary_key} = ? AND tenant_id = ?", (pk, tenant_id))
        db_client.execute(
            f"INSERT INTO {table.table_name} ({col_list}, updated_at) VALUES ({placeholders}, CURRENT_TIMESTAMP)",
            tuple(values),
        )
    return normalized


def delete_table_record(table_id: str, record_id: str, tenant_id: str) -> dict[str, Any]:
    _ensure_tables()
    table = _table_def(table_id)
    if _tx_on_postgres():
        pg_client.execute(
            f"DELETE FROM {table.table_name} WHERE {table.primary_key} = {_sql_placeholder()} AND tenant_id = {_sql_placeholder()}",
            (record_id, tenant_id),
        )
    else:
        db_client.execute(
            f"DELETE FROM {table.table_name} WHERE {table.primary_key} = {_sql_placeholder()} AND tenant_id = {_sql_placeholder()}",
            (record_id, tenant_id),
        )
    return {"deleted": record_id}


def bulk_delete_table_records(table_id: str, ids: list[str], tenant_id: str) -> dict[str, Any]:
    _ensure_tables()
    deleted = 0
    failures: list[str] = []
    for record_id in ids:
        try:
            delete_table_record(table_id, record_id, tenant_id=tenant_id)
            deleted += 1
        except Exception as exc:
            failures.append(f"{record_id}: {exc}")
    return {"deleted": deleted, "errors": failures}


def get_table_stats(table_id: str, tenant_id: str) -> dict[str, Any]:
    _ensure_tables()
    table = _table_def(table_id)
    rows = _execute(f"SELECT * FROM {table.table_name} WHERE tenant_id = {_sql_placeholder()}", (tenant_id,))
    total = len(rows)
    field_stats: dict[str, Any] = {}

    for field in table.fields:
        vals = [r.get(field.name) for r in rows if r.get(field.name) not in (None, "")]
        stats: dict[str, Any] = {
            "populated": len(vals),
            "populatedPercent": round((len(vals) / total * 100), 1) if total else 0,
            "unique": len(set(str(v) for v in vals)),
        }
        if field.type in {"number", "currency"}:
            nums = []
            for v in vals:
                try:
                    nums.append(float(v))
                except Exception:
                    pass
            if nums:
                stats["min"] = min(nums)
                stats["max"] = max(nums)
                stats["avg"] = sum(nums) / len(nums)
        field_stats[field.name] = stats

    latest = None
    for row in rows:
        ts = row.get("updated_at") or row.get("created_at")
        if ts is not None:
            ts_str = str(ts)
            if latest is None or ts_str > latest:
                latest = ts_str

    return {
        "totalRecords": total,
        "lastUpdated": latest,
        "fieldStats": field_stats,
    }
