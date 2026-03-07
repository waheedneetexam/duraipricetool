import pandas as pd
from app.db.postgres_client import pg_client

def get_waterfall_data(tenant_id: str = "default") -> list[dict]:
    rows = pg_client.execute(
        """
        SELECT
            SUM(list_price * quantity) AS gross_list_value,
            SUM((list_price - net_price) * quantity) AS discount_impact,
            SUM((net_price - cost) * quantity) AS margin_value
        FROM historical_transactions
        WHERE tenant_id = %s
        """,
        (tenant_id,),
    )
    if not rows or rows[0]["gross_list_value"] is None:
        return []
    row = rows[0]
    return [
        {"step": "Gross List", "value": float(row["gross_list_value"] or 0)},
        {"step": "Discount Impact", "value": -float(row["discount_impact"] or 0)},
        {"step": "Net Margin", "value": float(row["margin_value"] or 0)},
    ]

def get_scatter_data(limit: int = 2000, tenant_id: str = "default") -> list[dict]:
    rows = pg_client.execute(
        """
        SELECT
            sku,
            SUM(quantity) AS volume,
            AVG(net_price) AS avg_net_price,
            AVG(discount_percent) AS avg_discount
        FROM historical_transactions
        WHERE tenant_id = %s
        GROUP BY sku
        ORDER BY volume DESC
        LIMIT %s
        """,
        (tenant_id, limit),
    )
    return [dict(r) for r in rows]

def get_bar_data(tenant_id: str = "default") -> list[dict]:
    rows = pg_client.execute(
        """
        SELECT
            customer_segment,
            SUM(net_price * quantity) AS revenue,
            SUM(margin) AS margin
        FROM historical_transactions
        WHERE tenant_id = %s
        GROUP BY customer_segment
        ORDER BY revenue DESC
        """,
        (tenant_id,),
    )
    return [dict(r) for r in rows]

def get_time_series_data(tenant_id: str = "default") -> list[dict]:
    rows = pg_client.execute(
        """
        SELECT
            DATE_TRUNC('month', transaction_date) AS month,
            SUM(net_price * quantity) AS revenue,
            SUM(margin) AS margin
        FROM historical_transactions
        WHERE tenant_id = %s
        GROUP BY 1
        ORDER BY 1
        """,
        (tenant_id,),
    )
    return [dict(r) for r in rows]

def get_chart_drilldown(chart_type: str, key: str, tenant_id: str = "default") -> list[dict]:
    if chart_type == "bar":
        rows = pg_client.execute(
            """
            SELECT
                transaction_date,
                quote_id,
                sku,
                customer_name,
                quantity,
                list_price,
                discount_percent,
                net_price,
                margin
            FROM historical_transactions
            WHERE customer_segment = %s
              AND tenant_id = %s
            ORDER BY transaction_date DESC
            LIMIT 500
            """,
            (key, tenant_id),
        )
        return [dict(r) for r in rows]
    return []
