from dataclasses import dataclass

from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


@dataclass
class WorkflowDecision:
    allowed: bool
    next_state: str
    required_approver_role: str | None
    reason: str


class WorkflowEngine:
    def evaluate_transition(
        self,
        customer_id: str,
        customer_segment: str,
        discount_percent: float,
        current_state: str,
        requested_state: str,
    ) -> WorkflowDecision:
        if DB_ENGINE in {"postgres", "hybrid"}:
            rules_df = self._fetch_rules_postgres(
                current_state=current_state,
                requested_state=requested_state,
                customer_id=customer_id,
                customer_segment=customer_segment,
            )
        else:
            rules_df = db_client.fetch_df(
                """
                SELECT *
                FROM workflow_rules
                WHERE active = TRUE
                  AND state_from = ?
                  AND state_to = ?
                  AND (customer_id = ? OR customer_id IS NULL)
                  AND (customer_segment = ? OR customer_segment IS NULL)
                ORDER BY customer_id DESC NULLS LAST, customer_segment DESC NULLS LAST
                """,
                (current_state, requested_state, customer_id, customer_segment),
            )

        if rules_df.empty:
            return WorkflowDecision(
                allowed=True,
                next_state=requested_state,
                required_approver_role=None,
                reason="No matching rule. Transition allowed.",
            )

        for _, row in rules_df.iterrows():
            metric = row["metric_name"]
            comparator = row["comparator"]
            threshold = float(row["threshold"])
            approver = row["required_approver_role"]

            metric_value = discount_percent if metric == "discount_percent" else 0.0
            triggered = self._compare(metric_value, comparator, threshold)

            if triggered and approver:
                return WorkflowDecision(
                    allowed=False,
                    next_state=current_state,
                    required_approver_role=approver,
                    reason=(
                        f"Rule {row['rule_id']} triggered: "
                        f"{metric} {comparator} {threshold}. "
                        f"{approver} approval is required."
                    ),
                )

        return WorkflowDecision(
            allowed=True,
            next_state=requested_state,
            required_approver_role=None,
            reason="Rules evaluated successfully. Transition allowed.",
        )

    @staticmethod
    def _fetch_rules_postgres(
        current_state: str,
        requested_state: str,
        customer_id: str,
        customer_segment: str,
    ):
        rows = pg_client.execute(
            """
            SELECT *
            FROM workflow_rules
            WHERE active = TRUE
              AND state_from = %s
              AND state_to = %s
              AND (customer_id = %s OR customer_id IS NULL)
              AND (customer_segment = %s OR customer_segment IS NULL)
            ORDER BY customer_id DESC NULLS LAST, customer_segment DESC NULLS LAST
            """,
            (current_state, requested_state, customer_id, customer_segment),
        )
        import pandas as pd

        return pd.DataFrame(rows)

    @staticmethod
    def _compare(value: float, comparator: str, threshold: float) -> bool:
        if comparator == ">":
            return value > threshold
        if comparator == ">=":
            return value >= threshold
        if comparator == "<":
            return value < threshold
        if comparator == "<=":
            return value <= threshold
        if comparator == "==":
            return value == threshold
        return False
