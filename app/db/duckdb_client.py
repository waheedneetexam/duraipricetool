from pathlib import Path
import os

import duckdb

from app.core.config import DUCKDB_PATH


class DuckDBClient:
    def __init__(self, db_path: Path = DUCKDB_PATH):
        self.db_path = str(db_path)
        self.read_only = os.getenv("DUCKDB_READ_ONLY", "0").lower() in {"1", "true", "yes"}
        self.conn = duckdb.connect(self.db_path, read_only=self.read_only)
        self._initialize_schema()

    def _initialize_schema(self) -> None:
        if self.read_only:
            return
        schema_path = Path(__file__).resolve().parent / "schema.sql"
        self.conn.execute(schema_path.read_text())

    def execute(self, query: str, params: tuple | None = None):
        if params is None:
            return self.conn.execute(query)
        return self.conn.execute(query, params)

    def fetch_df(self, query: str, params: tuple | None = None):
        if params is None:
            return self.conn.execute(query).df()
        return self.conn.execute(query, params).df()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass

    def reconnect(self) -> None:
        self.conn = duckdb.connect(self.db_path, read_only=self.read_only)
        self._initialize_schema()


db_client = DuckDBClient()
