from app.db.duckdb_client import db_client


def get_waterfall_data() -> list[dict]:
    df = db_client.fetch_df(
        """
        SELECT
            SUM(list_price * quantity) AS gross_list_value,
            SUM((list_price - net_price) * quantity) AS discount_impact,
            SUM((net_price - cost) * quantity) AS margin_value
        FROM historical_transactions
        """
    )
    if df.empty:
        return []
    row = df.iloc[0]
    return [
        {"step": "Gross List", "value": float(row["gross_list_value"] or 0)},
        {"step": "Discount Impact", "value": -float(row["discount_impact"] or 0)},
        {"step": "Net Margin", "value": float(row["margin_value"] or 0)},
    ]


def get_scatter_data(limit: int = 2000) -> list[dict]:
    df = db_client.fetch_df(
        """
        SELECT
            sku,
            SUM(quantity) AS volume,
            AVG(net_price) AS avg_net_price,
            AVG(discount_percent) AS avg_discount
        FROM historical_transactions
        GROUP BY sku
        ORDER BY volume DESC
        LIMIT ?
        """,
        (limit,),
    )
    return df.to_dict(orient="records")


def get_bar_data() -> list[dict]:
    df = db_client.fetch_df(
        """
        SELECT
            customer_segment,
            SUM(net_price * quantity) AS revenue,
            SUM(margin) AS margin
        FROM historical_transactions
        GROUP BY customer_segment
        ORDER BY revenue DESC
        """
    )
    return df.to_dict(orient="records")


def get_time_series_data() -> list[dict]:
    df = db_client.fetch_df(
        """
        SELECT
            DATE_TRUNC('month', transaction_date) AS month,
            SUM(net_price * quantity) AS revenue,
            SUM(margin) AS margin
        FROM historical_transactions
        GROUP BY 1
        ORDER BY 1
        """
    )
    return df.to_dict(orient="records")


def get_chart_drilldown(chart_type: str, key: str) -> list[dict]:
    if chart_type == "bar":
        df = db_client.fetch_df(
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
            WHERE customer_segment = ?
            ORDER BY transaction_date DESC
            LIMIT 500
            """,
            (key,),
        )
        return df.to_dict(orient="records")
    return []
