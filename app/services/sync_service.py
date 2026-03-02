from dataclasses import dataclass
from datetime import datetime, timezone

import duckdb
import pandas as pd

from app.core.config import DB_ENGINE, SYNC_BATCH_SIZE
from app.core.config import DUCKDB_PATH
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


@dataclass
class SyncTableConfig:
    name: str
    pk: str
    insert_columns: list[str]
    cursor_pk_default: str
    where_pk_cast: str = ""


SYNC_TABLES = [
    SyncTableConfig(
        name="historical_transactions",
        pk="id",
        insert_columns=[
            "id",
            "transaction_date",
            "sku",
            "product_family",
            "customer_id",
            "customer_name",
            "customer_segment",
            "region",
            "list_price",
            "discount_percent",
            "net_price",
            "cost",
            "quantity",
            "revenue",
            "margin",
            "quote_id",
            "sales_rep",
            "currency",
        ],
        cursor_pk_default="0",
        where_pk_cast="::bigint",
    ),
    SyncTableConfig(
        name="quotes",
        pk="quote_id",
        insert_columns=[
            "quote_id",
            "customer_id",
            "customer_name",
            "customer_segment",
            "status",
            "header_fields",
            "total_list_price",
            "total_net_price",
            "total_cost",
            "total_margin",
            "created_at",
            "updated_at",
        ],
        cursor_pk_default="",
    ),
    SyncTableConfig(
        name="quote_line_items",
        pk="quote_line_id",
        insert_columns=[
            "quote_line_id",
            "quote_id",
            "sku",
            "quantity",
            "list_price",
            "discount_percent",
            "net_price",
            "cost",
            "margin",
            "dynamic_fields",
            "created_at",
            "updated_at",
        ],
        cursor_pk_default="",
    ),
]


def run_sync_once(batch_size: int = SYNC_BATCH_SIZE) -> dict:
    if DB_ENGINE not in {"hybrid", "postgres"}:
        return {"status": "skipped", "reason": f"DB_ENGINE={DB_ENGINE}. Sync requires hybrid/postgres."}

    synced = {}
    total_rows = 0
    db_client.close()
    try:
        with duckdb.connect(str(DUCKDB_PATH), read_only=False) as duck_conn:
            for table in SYNC_TABLES:
                rows = _sync_table(table, batch_size=batch_size, duck_conn=duck_conn)
                synced[table.name] = rows
                total_rows += rows
    finally:
        db_client.reconnect()
    return {"status": "ok", "total_rows_synced": total_rows, "tables": synced}


def _sync_table(config: SyncTableConfig, batch_size: int, duck_conn) -> int:
    state = _get_sync_state(config.name)
    cursor_ts = state["last_cursor_ts"] or datetime(1970, 1, 1, tzinfo=timezone.utc)
    cursor_pk = state["last_cursor_id"] if state["last_cursor_id"] is not None else config.cursor_pk_default

    rows_synced = 0
    while True:
        rows = pg_client.execute(
            f"""
            SELECT
                {", ".join(config.insert_columns)},
                updated_at AS _cursor_updated_at,
                {config.pk} AS _cursor_pk
            FROM {config.name}
            WHERE (
                updated_at > %s
                OR (updated_at = %s AND {config.pk}{config.where_pk_cast} > %s{config.where_pk_cast})
            )
            ORDER BY updated_at ASC, {config.pk} ASC
            LIMIT %s
            """,
            (cursor_ts, cursor_ts, cursor_pk, batch_size),
        )
        if not rows:
            break

        df = pd.DataFrame(rows)
        cols_sql = ", ".join(config.insert_columns)
        duck_conn.register("sync_batch", df[config.insert_columns])
        duck_conn.execute(f"DELETE FROM {config.name} WHERE {config.pk} IN (SELECT {config.pk} FROM sync_batch)")
        duck_conn.execute(f"INSERT INTO {config.name} ({cols_sql}) SELECT {cols_sql} FROM sync_batch")
        duck_conn.unregister("sync_batch")

        last = rows[-1]
        cursor_ts = last["_cursor_updated_at"]
        cursor_pk = str(last["_cursor_pk"])
        rows_synced += len(rows)
        _upsert_sync_state(config.name, cursor_ts, cursor_pk)

    return rows_synced


def _get_sync_state(sync_name: str) -> dict:
    rows = pg_client.execute(
        "SELECT sync_name, last_cursor_ts, last_cursor_id FROM sync_state WHERE sync_name = %s",
        (sync_name,),
    )
    if not rows:
        return {"sync_name": sync_name, "last_cursor_ts": None, "last_cursor_id": None}
    return rows[0]


def _upsert_sync_state(sync_name: str, cursor_ts, cursor_id: str) -> None:
    pg_client.execute(
        """
        INSERT INTO sync_state (sync_name, last_cursor_ts, last_cursor_id, updated_at)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (sync_name) DO UPDATE SET
            last_cursor_ts = EXCLUDED.last_cursor_ts,
            last_cursor_id = EXCLUDED.last_cursor_id,
            updated_at = CURRENT_TIMESTAMP
        """,
        (sync_name, cursor_ts, cursor_id),
    )
