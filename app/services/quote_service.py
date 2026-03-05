import json
from uuid import uuid4

import pandas as pd
from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client
from app.engines.formula_engine import SafeFormulaEngine
from app.engines.workflow_engine import WorkflowEngine
from app.models.schemas import (
    QuoteCalculationRequest,
    QuoteSaveRequest,
    WorkflowEvaluationRequest,
)


DEFAULT_LINE_FORMULAS = [
    {"target_field": "net_price", "expression": "list_price * (1 - discount_percent)"},
    {"target_field": "margin", "expression": "(net_price - cost) * quantity"},
]


def _tx_on_postgres() -> bool:
    return DB_ENGINE in {"postgres", "hybrid"}


def calculate_quote(payload: QuoteCalculationRequest, tenant_id: str = "default") -> dict:
    engine = SafeFormulaEngine()
    formulas = [f.model_dump() for f in payload.formulas] or DEFAULT_LINE_FORMULAS

    computed_lines = []
    totals = {"total_list_price": 0.0, "total_net_price": 0.0, "total_cost": 0.0, "total_margin": 0.0}
    total_qty = 0

    for item in payload.line_items:
        line = item.model_dump()
        base_context = {
            "list_price": line["list_price"],
            "discount_percent": line["discount_percent"],
            "cost": line["cost"],
            "quantity": line["quantity"],
        }
        computed = engine.evaluate_formulas(formulas, base_context)
        line["net_price"] = computed.get("net_price", base_context["list_price"])
        line["margin"] = computed.get("margin", (line["net_price"] - line["cost"]) * line["quantity"])
        line["extended_list"] = line["list_price"] * line["quantity"]
        line["extended_net"] = line["net_price"] * line["quantity"]
        computed_lines.append(line)

        totals["total_list_price"] += line["extended_list"]
        totals["total_net_price"] += line["extended_net"]
        totals["total_cost"] += line["cost"] * line["quantity"]
        totals["total_margin"] += line["margin"]
        total_qty += line["quantity"]

    status = "Draft"
    _persist_quote(payload, computed_lines, totals, status, tenant_id=tenant_id)
    return {
        "quote_id": payload.header.quote_id,
        "status": status,
        "totals": totals,
        "line_items": computed_lines,
        "embedded_analytics": _embedded_analytics(payload.header.customer_id, total_qty, tenant_id=tenant_id),
    }


def evaluate_workflow(payload: WorkflowEvaluationRequest, tenant_id: str = "default") -> dict:
    decision = WorkflowEngine().evaluate_transition(
        customer_id=payload.customer_id,
        customer_segment=payload.customer_segment,
        discount_percent=payload.discount_percent,
        current_state=payload.current_state,
        requested_state=payload.requested_state,
        tenant_id=tenant_id,
    )
    return {
        "allowed": decision.allowed,
        "next_state": decision.next_state,
        "required_approver_role": decision.required_approver_role,
        "reason": decision.reason,
    }


def seed_default_workflow_rules(tenant_id: str = "default") -> dict:
    defaults = [
        {
            "rule_id": str(uuid4()),
            "customer_id": "CustomerA",
            "customer_segment": None,
            "state_from": "Draft",
            "state_to": "Pending Approval",
            "metric_name": "discount_percent",
            "comparator": ">",
            "threshold": 0.20,
            "required_approver_role": "VP",
        },
        {
            "rule_id": str(uuid4()),
            "customer_id": "CustomerB",
            "customer_segment": None,
            "state_from": "Draft",
            "state_to": "Pending Approval",
            "metric_name": "discount_percent",
            "comparator": ">",
            "threshold": 0.10,
            "required_approver_role": "VP",
        },
    ]

    for rule in defaults:
        if _tx_on_postgres():
            pg_client.execute(
                """
                INSERT INTO workflow_rules (
                    rule_id, tenant_id, customer_id, customer_segment, state_from, state_to,
                    metric_name, comparator, threshold, required_approver_role, active, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)
                """,
                (
                    rule["rule_id"],
                    tenant_id,
                    rule["customer_id"],
                    rule["customer_segment"],
                    rule["state_from"],
                    rule["state_to"],
                    rule["metric_name"],
                    rule["comparator"],
                    rule["threshold"],
                    rule["required_approver_role"],
                ),
            )
        else:
            db_client.execute(
                """
                INSERT INTO workflow_rules (
                    rule_id, tenant_id, customer_id, customer_segment, state_from, state_to,
                    metric_name, comparator, threshold, required_approver_role, active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
                """,
                (
                    rule["rule_id"],
                    tenant_id,
                    rule["customer_id"],
                    rule["customer_segment"],
                    rule["state_from"],
                    rule["state_to"],
                    rule["metric_name"],
                    rule["comparator"],
                    rule["threshold"],
                    rule["required_approver_role"],
                ),
            )
    return {"seeded_rules": len(defaults)}


def _persist_quote(payload: QuoteCalculationRequest, line_items: list[dict], totals: dict, status: str, tenant_id: str = "default") -> None:
    header = payload.header
    if _tx_on_postgres():
        pg_client.execute(
            """
            INSERT INTO quotes (
                quote_id, tenant_id, customer_id, customer_name, customer_segment, status,
                header_fields, total_list_price, total_net_price, total_cost, total_margin, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (quote_id) DO UPDATE SET
                customer_id = EXCLUDED.customer_id,
                customer_name = EXCLUDED.customer_name,
                customer_segment = EXCLUDED.customer_segment,
                status = EXCLUDED.status,
                header_fields = EXCLUDED.header_fields,
                total_list_price = EXCLUDED.total_list_price,
                total_net_price = EXCLUDED.total_net_price,
                total_cost = EXCLUDED.total_cost,
                total_margin = EXCLUDED.total_margin,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                header.quote_id,
                tenant_id,
                header.customer_id,
                header.customer_name,
                header.customer_segment,
                status,
                json.dumps(header.header_fields),
                totals["total_list_price"],
                totals["total_net_price"],
                totals["total_cost"],
                totals["total_margin"],
            ),
        )
        pg_client.execute("DELETE FROM quote_line_items WHERE quote_id = %s AND tenant_id = %s", (header.quote_id, tenant_id))
        for item in line_items:
            pg_client.execute(
                """
                INSERT INTO quote_line_items (
                    quote_line_id, quote_id, tenant_id, sku, quantity, list_price,
                    discount_percent, net_price, cost, margin, dynamic_fields, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, CURRENT_TIMESTAMP)
                """,
                (
                    item["quote_line_id"],
                    header.quote_id,
                    tenant_id,
                    item["sku"],
                    item["quantity"],
                    item["list_price"],
                    item["discount_percent"],
                    item["net_price"],
                    item["cost"],
                    item["margin"],
                    json.dumps(item["dynamic_fields"]),
                ),
            )
    else:
        db_client.execute(
            """
            INSERT OR REPLACE INTO quotes (
                quote_id, tenant_id, customer_id, customer_name, customer_segment, status,
                header_fields, total_list_price, total_net_price, total_cost, total_margin, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                header.quote_id,
                tenant_id,
                header.customer_id,
                header.customer_name,
                header.customer_segment,
                status,
                json.dumps(header.header_fields),
                totals["total_list_price"],
                totals["total_net_price"],
                totals["total_cost"],
                totals["total_margin"],
            ),
        )

        db_client.execute("DELETE FROM quote_line_items WHERE quote_id = ? AND tenant_id = ?", (header.quote_id, tenant_id))
        for item in line_items:
            db_client.execute(
                """
                INSERT INTO quote_line_items (
                    quote_line_id, quote_id, tenant_id, sku, quantity, list_price,
                    discount_percent, net_price, cost, margin, dynamic_fields, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    item["quote_line_id"],
                    header.quote_id,
                    tenant_id,
                    item["sku"],
                    item["quantity"],
                    item["list_price"],
                    item["discount_percent"],
                    item["net_price"],
                    item["cost"],
                    item["margin"],
                    json.dumps(item["dynamic_fields"]),
                ),
            )


def _embedded_analytics(customer_id: str, quote_quantity: int, tenant_id: str = "default") -> dict:
    trend = db_client.fetch_df(
        """
        SELECT
            DATE_TRUNC('month', transaction_date) AS month,
            AVG(net_price) AS avg_net_price
        FROM historical_transactions
        WHERE customer_id = ?
          AND tenant_id = ?
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 6
        """,
        (customer_id, tenant_id),
    ).to_dict(orient="records")

    quote_bridge = {
        "steps": [
            {"step": "Requested Quantity", "value": quote_quantity},
            {"step": "Historical Avg Qty", "value": _historical_avg_quantity(customer_id, tenant_id=tenant_id)},
        ]
    }
    return {"historical_trend": list(reversed(trend)), "mini_waterfall": quote_bridge}


def _historical_avg_quantity(customer_id: str, tenant_id: str = "default") -> float:
    row = db_client.execute(
        """
        SELECT COALESCE(AVG(quantity), 0)
        FROM historical_transactions
        WHERE customer_id = ?
          AND tenant_id = ?
        """,
        (customer_id, tenant_id),
    ).fetchone()
    return float(row[0] or 0.0)


def list_quotes(tenant_id: str = "default") -> list[dict]:
    if _tx_on_postgres():
        rows = pg_client.execute(
            """
            SELECT
                q.quote_id,
                q.customer_id,
                q.customer_name,
                q.customer_segment,
                q.status,
                q.header_fields,
                q.total_net_price,
                q.created_at,
                q.updated_at,
                COUNT(li.quote_line_id) AS line_item_count
            FROM quotes q
            LEFT JOIN quote_line_items li ON li.quote_id = q.quote_id AND li.tenant_id = q.tenant_id
            WHERE q.tenant_id = %s
            GROUP BY
                q.quote_id,
                q.customer_id,
                q.customer_name,
                q.customer_segment,
                q.status,
                q.header_fields,
                q.total_net_price,
                q.created_at,
                q.updated_at
            ORDER BY q.updated_at DESC
            """,
            (tenant_id,),
        )
        df = pd.DataFrame(rows)
    else:
        df = db_client.fetch_df(
            """
            SELECT
                q.quote_id,
                q.customer_id,
                q.customer_name,
                q.customer_segment,
                q.status,
                q.header_fields,
                q.total_net_price,
                q.created_at,
                q.updated_at,
                COUNT(li.quote_line_id) AS line_item_count
            FROM quotes q
            LEFT JOIN quote_line_items li ON li.quote_id = q.quote_id AND li.tenant_id = q.tenant_id
            WHERE q.tenant_id = ?
            GROUP BY
                q.quote_id,
                q.customer_id,
                q.customer_name,
                q.customer_segment,
                q.status,
                q.header_fields,
                q.total_net_price,
                q.created_at,
                q.updated_at
            ORDER BY q.updated_at DESC
            """,
            (tenant_id,),
        )
    records = []
    for row in df.to_dict(orient="records"):
        header_fields = _safe_json_loads(row.get("header_fields"))
        records.append(
            {
                "id": row["quote_id"],
                "description": header_fields.get("description", ""),
                "customerName": row.get("customer_name") or header_fields.get("customerName", ""),
                "dateCreated": str(row.get("created_at")),
                "dateModified": str(row.get("updated_at")),
                "totalValue": float(row.get("total_net_price") or 0.0),
                "lineItemCount": int(row.get("line_item_count") or 0),
                "status": row.get("status") or "Draft",
            }
        )
    return records


def get_quote(quote_id: str, tenant_id: str = "default") -> dict | None:
    if _tx_on_postgres():
        quote_df = pd.DataFrame(pg_client.execute("SELECT * FROM quotes WHERE quote_id = %s AND tenant_id = %s", (quote_id, tenant_id)))
    else:
        quote_df = db_client.fetch_df("SELECT * FROM quotes WHERE quote_id = ? AND tenant_id = ?", (quote_id, tenant_id))
    if quote_df.empty:
        return None

    quote = quote_df.iloc[0].to_dict()
    header_fields = _safe_json_loads(quote.get("header_fields"))
    if _tx_on_postgres():
        lines_df = pd.DataFrame(
            pg_client.execute(
                """
                SELECT
                    quote_line_id,
                    sku,
                    quantity,
                    list_price,
                    cost,
                    discount_percent,
                    net_price,
                    margin,
                    dynamic_fields
                FROM quote_line_items
                WHERE quote_id = %s AND tenant_id = %s
                ORDER BY created_at
                """,
                (quote_id, tenant_id),
            )
        )
    else:
        lines_df = db_client.fetch_df(
            """
            SELECT
                quote_line_id,
                sku,
                quantity,
                list_price,
                cost,
                discount_percent,
                net_price,
                margin,
                dynamic_fields
            FROM quote_line_items
            WHERE quote_id = ? AND tenant_id = ?
            ORDER BY created_at
            """,
            (quote_id, tenant_id),
        )

    line_items = []
    for row in lines_df.to_dict(orient="records"):
        dynamic_fields = _safe_json_loads(row.get("dynamic_fields"))
        quantity = float(row.get("quantity") or 0.0)
        net_price = float(row.get("net_price") or 0.0)
        total_value = float(dynamic_fields.get("totalValue", net_price * quantity))
        margin_percent = float(
            dynamic_fields.get(
                "marginPercent",
                ((net_price - float(row.get("cost") or 0.0)) / net_price * 100) if net_price else 0.0,
            )
        )

        line_items.append(
            {
                "id": row["quote_line_id"],
                "productName": dynamic_fields.get("productName", row.get("sku", "")),
                "sku": row.get("sku", ""),
                "quantity": quantity,
                "listPrice": float(row.get("list_price") or 0.0),
                "cost": float(row.get("cost") or 0.0),
                "volumeDiscount": float(dynamic_fields.get("volumeDiscount", (row.get("discount_percent") or 0.0) * 100)),
                "rebate": float(dynamic_fields.get("rebate", 0.0)),
                "netPrice": net_price,
                "margin": margin_percent,
                "totalValue": total_value,
                "showAnalytics": False,
            }
        )

    return {
        "id": quote["quote_id"],
        "description": header_fields.get("description", ""),
        "customerName": quote.get("customer_name", ""),
        "customerId": quote.get("customer_id", ""),
        "customerSegment": quote.get("customer_segment", ""),
        "productHierarchy": header_fields.get("productHierarchy", ""),
        "salesOrg": header_fields.get("salesOrg", ""),
        "region": header_fields.get("region", ""),
        "country": header_fields.get("country", ""),
        "currency": header_fields.get("currency", "USD"),
        "priceList": header_fields.get("priceList", ""),
        "validityDate": header_fields.get("validityDate", ""),
        "paymentTerms": header_fields.get("paymentTerms", ""),
        "lineItems": line_items,
        "totalValue": float(quote.get("total_net_price") or 0.0),
        "lineItemCount": len(line_items),
        "dateCreated": str(quote.get("created_at")),
        "dateModified": str(quote.get("updated_at")),
    }


def save_quote(payload: QuoteSaveRequest, tenant_id: str = "default") -> dict:
    quote_id = payload.id or f"Q-{str(uuid4())[:8].upper()}"
    line_items, totals = _compute_lines(payload.lineItems)

    header_fields = {
        "description": payload.description,
        "customerName": payload.customerName,
        "productHierarchy": payload.productHierarchy,
        "salesOrg": payload.salesOrg,
        "region": payload.region,
        "country": payload.country,
        "currency": payload.currency,
        "priceList": payload.priceList,
        "validityDate": payload.validityDate,
        "paymentTerms": payload.paymentTerms,
    }

    if _tx_on_postgres():
        pg_client.execute(
            """
            INSERT INTO quotes (
                quote_id, tenant_id, customer_id, customer_name, customer_segment, status,
                header_fields, total_list_price, total_net_price, total_cost, total_margin, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (quote_id) DO UPDATE SET
                customer_id = EXCLUDED.customer_id,
                customer_name = EXCLUDED.customer_name,
                customer_segment = EXCLUDED.customer_segment,
                status = EXCLUDED.status,
                header_fields = EXCLUDED.header_fields,
                total_list_price = EXCLUDED.total_list_price,
                total_net_price = EXCLUDED.total_net_price,
                total_cost = EXCLUDED.total_cost,
                total_margin = EXCLUDED.total_margin,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                quote_id,
                tenant_id,
                payload.customerId or payload.customerName,
                payload.customerName,
                payload.customerSegment or "Enterprise",
                "Draft",
                json.dumps(header_fields),
                totals["total_list_price"],
                totals["total_net_price"],
                totals["total_cost"],
                totals["total_margin_amount"],
            ),
        )
        pg_client.execute("DELETE FROM quote_line_items WHERE quote_id = %s AND tenant_id = %s", (quote_id, tenant_id))
        for line in line_items:
            pg_client.execute(
                """
                INSERT INTO quote_line_items (
                    quote_line_id, quote_id, tenant_id, sku, quantity, list_price,
                    discount_percent, net_price, cost, margin, dynamic_fields, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, CURRENT_TIMESTAMP)
                """,
                (
                    line["id"],
                    quote_id,
                    tenant_id,
                    line["sku"],
                    line["quantity"],
                    line["listPrice"],
                    line["volumeDiscount"] / 100.0,
                    line["netPrice"],
                    line["cost"],
                    line["marginAmount"],
                    json.dumps(
                        {
                            "productName": line["productName"],
                            "volumeDiscount": line["volumeDiscount"],
                            "rebate": line["rebate"],
                            "marginPercent": line["margin"],
                            "totalValue": line["totalValue"],
                        }
                    ),
                ),
            )
    else:
        db_client.execute(
            """
            INSERT OR REPLACE INTO quotes (
                quote_id, tenant_id, customer_id, customer_name, customer_segment, status,
                header_fields, total_list_price, total_net_price, total_cost, total_margin, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                quote_id,
                tenant_id,
                payload.customerId or payload.customerName,
                payload.customerName,
                payload.customerSegment or "Enterprise",
                "Draft",
                json.dumps(header_fields),
                totals["total_list_price"],
                totals["total_net_price"],
                totals["total_cost"],
                totals["total_margin_amount"],
            ),
        )

        db_client.execute("DELETE FROM quote_line_items WHERE quote_id = ? AND tenant_id = ?", (quote_id, tenant_id))
        for line in line_items:
            db_client.execute(
                """
                INSERT INTO quote_line_items (
                    quote_line_id, quote_id, tenant_id, sku, quantity, list_price,
                    discount_percent, net_price, cost, margin, dynamic_fields, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    line["id"],
                    quote_id,
                    tenant_id,
                    line["sku"],
                    line["quantity"],
                    line["listPrice"],
                    line["volumeDiscount"] / 100.0,
                    line["netPrice"],
                    line["cost"],
                    line["marginAmount"],
                    json.dumps(
                        {
                            "productName": line["productName"],
                            "volumeDiscount": line["volumeDiscount"],
                            "rebate": line["rebate"],
                            "marginPercent": line["margin"],
                            "totalValue": line["totalValue"],
                        }
                    ),
                ),
            )

    return {"success": True, "data": {"id": quote_id, "totalValue": totals["total_net_price"]}}


def delete_quote(quote_id: str, tenant_id: str = "default") -> dict:
    if _tx_on_postgres():
        pg_client.execute("DELETE FROM quote_line_items WHERE quote_id = %s AND tenant_id = %s", (quote_id, tenant_id))
        pg_client.execute("DELETE FROM quotes WHERE quote_id = %s AND tenant_id = %s", (quote_id, tenant_id))
    else:
        db_client.execute("DELETE FROM quote_line_items WHERE quote_id = ? AND tenant_id = ?", (quote_id, tenant_id))
        db_client.execute("DELETE FROM quotes WHERE quote_id = ? AND tenant_id = ?", (quote_id, tenant_id))
    return {"success": True, "deletedQuoteId": quote_id}


def _compute_lines(line_items: list) -> tuple[list[dict], dict]:
    computed = []
    totals = {
        "total_list_price": 0.0,
        "total_net_price": 0.0,
        "total_cost": 0.0,
        "total_margin_amount": 0.0,
    }

    for item in line_items:
        line = item.model_dump()
        quantity = float(line["quantity"])
        list_price = float(line["listPrice"])
        cost = float(line["cost"])
        volume_discount = float(line.get("volumeDiscount", 0.0))
        rebate = float(line.get("rebate", 0.0))

        discounted_price = list_price * (1 - volume_discount / 100.0)
        total_before_rebate = discounted_price * quantity
        total_value = total_before_rebate - rebate
        net_price = total_value / quantity if quantity else 0.0
        total_cost = cost * quantity
        margin_amount = total_value - total_cost
        margin_percent = (margin_amount / total_value * 100.0) if total_value else 0.0

        line["netPrice"] = net_price
        line["margin"] = margin_percent
        line["totalValue"] = total_value
        line["marginAmount"] = margin_amount
        computed.append(line)

        totals["total_list_price"] += list_price * quantity
        totals["total_net_price"] += total_value
        totals["total_cost"] += total_cost
        totals["total_margin_amount"] += margin_amount

    return computed, totals


def _safe_json_loads(value) -> dict:
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except Exception:
        return {}
