import random
from datetime import date, timedelta

import pandas as pd

from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


SEGMENTS = ["Enterprise", "Mid-Market", "SMB", "Public Sector"]
REGIONS = ["NA", "EMEA", "APAC", "LATAM"]
PRODUCT_FAMILIES = ["Compute", "Storage", "Security", "Network", "Analytics"]
CURRENCIES = ["USD", "EUR", "GBP"]


def generate_synthetic_transactions(row_count: int = 10000, tenant_id: str = "default") -> dict[str, int]:
    start_date = date.today() - timedelta(days=730)
    rows = []
    if DB_ENGINE in {"postgres", "hybrid"}:
        max_row = pg_client.execute("SELECT COALESCE(MAX(id), 0) AS max_id FROM historical_transactions")
        max_id = int((max_row[0]["max_id"] if max_row else 0) or 0)
    else:
        max_id = int(db_client.execute("SELECT COALESCE(MAX(id), 0) FROM historical_transactions").fetchone()[0])

    for i in range(row_count):
        sku_num = random.randint(1000, 9999)
        customer_num = random.randint(1, 500)
        list_price = round(random.uniform(100, 5000), 2)
        discount = round(random.uniform(0.02, 0.35), 4)
        net_price = round(list_price * (1 - discount), 2)
        cost = round(net_price * random.uniform(0.55, 0.9), 2)
        qty = random.randint(1, 250)
        tx_date = start_date + timedelta(days=random.randint(0, 730))

        rows.append(
            {
                "id": max_id + i + 1,
                "transaction_date": tx_date,
                "sku": f"SKU-{sku_num}",
                "product_family": random.choice(PRODUCT_FAMILIES),
                "customer_id": f"CUST-{customer_num:04d}",
                "customer_name": f"Customer {customer_num:04d}",
                "customer_segment": random.choice(SEGMENTS),
                "region": random.choice(REGIONS),
                "list_price": list_price,
                "discount_percent": discount,
                "net_price": net_price,
                "cost": cost,
                "quantity": qty,
                "revenue": round(net_price * qty, 2),
                "margin": round((net_price - cost) * qty, 2),
                "quote_id": f"Q-{random.randint(10000, 99999)}",
                "sales_rep": f"rep_{random.randint(1, 60)}",
                "currency": random.choice(CURRENCIES),
            }
        )

    if DB_ENGINE in {"postgres", "hybrid"}:
        params = [
            (
                r["id"],
                r["transaction_date"],
                r["sku"],
                r["product_family"],
                r["customer_id"],
                r["customer_name"],
                r["customer_segment"],
                r["region"],
                r["list_price"],
                r["discount_percent"],
                r["net_price"],
                r["cost"],
                r["quantity"],
                r["revenue"],
                r["margin"],
                r["quote_id"],
                r["sales_rep"],
                r["currency"],
                tenant_id,
            )
            for r in rows
        ]
        pg_client.executemany(
            """
            INSERT INTO historical_transactions (
                id, transaction_date, sku, product_family, customer_id, customer_name, customer_segment,
                region, list_price, discount_percent, net_price, cost, quantity, revenue, margin,
                quote_id, sales_rep, currency, tenant_id, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
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
                tenant_id = EXCLUDED.tenant_id,
                updated_at = CURRENT_TIMESTAMP
            """,
            params,
        )
    else:
        df = pd.DataFrame(rows)
        df["tenant_id"] = tenant_id
        db_client.conn.register("synthetic_df", df)
        db_client.execute(
            """
            INSERT INTO historical_transactions (
                id, transaction_date, sku, product_family, customer_id, customer_name, customer_segment,
                region, list_price, discount_percent, net_price, cost, quantity, revenue, margin,
                quote_id, sales_rep, currency, tenant_id
            )
            SELECT
                id, transaction_date, sku, product_family, customer_id, customer_name, customer_segment,
                region, list_price, discount_percent, net_price, cost, quantity, revenue, margin,
                quote_id, sales_rep, currency, tenant_id
            FROM synthetic_df
            """
        )
        db_client.conn.unregister("synthetic_df")
    return {"rows_inserted": row_count}
