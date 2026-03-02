from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.core.config import PG_DSN


class PostgresClient:
    def __init__(self, dsn: str = PG_DSN):
        self.dsn = dsn

    def get_conn(self):
        conn = psycopg.connect(self.dsn, row_factory=dict_row)
        with conn.cursor() as cur:
            cur.execute("SET TIME ZONE 'UTC'")
            cur.execute("SET application_name = 'durai-pricing-tool'")
        return conn

    def initialize_schema(self) -> None:
        schema_path = Path(__file__).resolve().parent / "postgres_schema.sql"
        sql = schema_path.read_text()
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()

    def execute(self, query: str, params: tuple | list | None = None) -> list[dict[str, Any]]:
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall() if cur.description else []
            conn.commit()
            return rows

    def executemany(self, query: str, params_seq: list[tuple]):
        with self.get_conn() as conn:
            with conn.cursor() as cur:
                cur.executemany(query, params_seq)
            conn.commit()


pg_client = PostgresClient()
