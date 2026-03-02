from pathlib import Path

import pandas as pd

from app.core.config import CSV_CHUNK_SIZE, DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client
from app.models.schemas import CSVColumnMapping


TARGET_COLUMNS = [
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
    "quote_id",
    "sales_rep",
    "currency",
]


def ingest_csv_chunked(file_path: Path, mapping: CSVColumnMapping) -> dict[str, int]:
    source_to_target = {getattr(mapping, field): field for field in TARGET_COLUMNS}
    rows_inserted = 0
    chunks = 0
    if DB_ENGINE in {"postgres", "hybrid"}:
        row = pg_client.execute("SELECT COALESCE(MAX(id), 0) AS max_id FROM historical_transactions")
        existing_count = int((row[0]["max_id"] if row else 0) or 0)
    else:
        existing_count = int(
            db_client.execute("SELECT COALESCE(MAX(id), 0) FROM historical_transactions").fetchone()[0]
        )

    for chunk in pd.read_csv(file_path, chunksize=CSV_CHUNK_SIZE):
        chunks += 1
        mapped = _map_and_normalize_chunk(chunk, source_to_target)
        mapped.insert(0, "id", range(existing_count + 1, existing_count + 1 + len(mapped)))
        existing_count += len(mapped)

        if DB_ENGINE in {"postgres", "hybrid"}:
            params = []
            for _, row in mapped.iterrows():
                revenue = float(row["net_price"]) * int(row["quantity"])
                margin = (float(row["net_price"]) - float(row["cost"])) * int(row["quantity"])
                params.append(
                    (
                        int(row["id"]),
                        row["transaction_date"],
                        row["sku"],
                        row["product_family"],
                        row["customer_id"],
                        row["customer_name"],
                        row["customer_segment"],
                        row["region"],
                        float(row["list_price"]),
                        float(row["discount_percent"]),
                        float(row["net_price"]),
                        float(row["cost"]),
                        int(row["quantity"]),
                        revenue,
                        margin,
                        row["quote_id"],
                        row["sales_rep"],
                        row["currency"],
                    )
                )
            pg_client.executemany(
                """
                INSERT INTO historical_transactions (
                    id, transaction_date, sku, product_family, customer_id, customer_name, customer_segment,
                    region, list_price, discount_percent, net_price, cost, quantity, revenue, margin,
                    quote_id, sales_rep, currency, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET
                    transaction_date = EXCLUDED.transaction_date,
                    sku = EXCLUDED.sku,
                    product_family = EXCLUDED.product_family,
                    customer_id = EXCLUDED.customer_id,
                    customer_name = EXCLUDED.customer_name,
                    customer_segment = EXCLUDED.customer_segment,
                    region = EXCLUDED.region,
                    list_price = EXCLUDED.list_price,
                    discount_percent = EXCLUDED.discount_percent,
                    net_price = EXCLUDED.net_price,
                    cost = EXCLUDED.cost,
                    quantity = EXCLUDED.quantity,
                    revenue = EXCLUDED.revenue,
                    margin = EXCLUDED.margin,
                    quote_id = EXCLUDED.quote_id,
                    sales_rep = EXCLUDED.sales_rep,
                    currency = EXCLUDED.currency,
                    updated_at = CURRENT_TIMESTAMP
                """,
                params,
            )
        else:
            db_client.conn.register("chunk_df", mapped)
            db_client.execute(
                """
                INSERT INTO historical_transactions
                SELECT
                    id,
                    CAST(transaction_date AS DATE),
                    sku,
                    product_family,
                    customer_id,
                    customer_name,
                    customer_segment,
                    region,
                    list_price,
                    discount_percent,
                    net_price,
                    cost,
                    quantity,
                    net_price * quantity AS revenue,
                    (net_price - cost) * quantity AS margin,
                    quote_id,
                    sales_rep,
                    currency
                FROM chunk_df
                """
            )
            db_client.conn.unregister("chunk_df")
        rows_inserted += len(mapped)

    return {"rows_inserted": rows_inserted, "chunks": chunks}


def _map_and_normalize_chunk(chunk: pd.DataFrame, source_to_target: dict[str, str]) -> pd.DataFrame:
    available = {source: target for source, target in source_to_target.items() if source in chunk.columns}
    mapped = chunk.rename(columns=available)

    for col in TARGET_COLUMNS:
        if col not in mapped.columns:
            mapped[col] = None

    mapped["list_price"] = pd.to_numeric(mapped["list_price"], errors="coerce").fillna(0.0)
    mapped["discount_percent"] = pd.to_numeric(mapped["discount_percent"], errors="coerce").fillna(0.0)
    mapped["cost"] = pd.to_numeric(mapped["cost"], errors="coerce").fillna(0.0)
    mapped["quantity"] = pd.to_numeric(mapped["quantity"], errors="coerce").fillna(1).astype(int)

    if mapped["net_price"].isna().all():
        mapped["net_price"] = mapped["list_price"] * (1 - mapped["discount_percent"])
    else:
        mapped["net_price"] = pd.to_numeric(mapped["net_price"], errors="coerce").fillna(
            mapped["list_price"] * (1 - mapped["discount_percent"])
        )

    mapped["transaction_date"] = pd.to_datetime(mapped["transaction_date"], errors="coerce").dt.date
    mapped["transaction_date"] = mapped["transaction_date"].fillna(pd.Timestamp("today").date())

    return mapped[TARGET_COLUMNS]
