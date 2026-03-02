from app.db.duckdb_client import db_client


def question_to_sql(question: str) -> str:
    q = question.lower()
    if "margin leak" in q and "q3" in q:
        return """
        SELECT
            DATE_PART('year', transaction_date) AS year,
            SUM((list_price - net_price) * quantity) AS margin_leak
        FROM historical_transactions
        WHERE DATE_PART('quarter', transaction_date) = 3
        GROUP BY 1
        ORDER BY 1 DESC
        """
    if "top skus" in q or "top sku" in q:
        return """
        SELECT sku, SUM(net_price * quantity) AS revenue
        FROM historical_transactions
        GROUP BY sku
        ORDER BY revenue DESC
        LIMIT 10
        """
    return """
    SELECT
        customer_segment,
        SUM(net_price * quantity) AS revenue,
        SUM(margin) AS margin
    FROM historical_transactions
    GROUP BY customer_segment
    ORDER BY revenue DESC
    """


def ask(question: str) -> dict:
    sql = question_to_sql(question)
    result = db_client.fetch_df(sql).to_dict(orient="records")
    return {"generated_sql": sql.strip(), "result": result}
