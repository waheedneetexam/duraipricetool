from pathlib import Path
import os
from datetime import datetime

import duckdb

from app.core.config import DUCKDB_PATH


class DuckDBClient:
    def __init__(self, db_path: Path = DUCKDB_PATH):
        self.db_path = str(db_path)
        self.read_only = os.getenv("DUCKDB_READ_ONLY", "0").lower() in {"1", "true", "yes"}
        # In hybrid mode with DUCKDB_READ_ONLY, skip the connection entirely —
        # DuckDB only allows one process to hold ANY lock (even read-only).
        # The sync worker is the sole writer; the backend uses PG for everything.
        self._skip_connection = self.read_only
        self.conn = None
        if not self._skip_connection:
            self.conn = self._connect_with_recovery()
            self._initialize_schema()

    def _connect_with_recovery(self):
        try:
            return duckdb.connect(self.db_path, read_only=self.read_only)
        except Exception as exc:
            message = str(exc)
            wal_path = f"{self.db_path}.wal"
            needs_recovery = "Failure while replaying WAL file" in message and os.path.exists(wal_path)
            if not needs_recovery:
                raise

            # Preserve the problematic WAL for postmortem, then retry cleanly.
            stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            backup_path = f"{wal_path}.broken-{stamp}"
            try:
                os.replace(wal_path, backup_path)
            except Exception:
                # If WAL cannot be moved, bubble up original failure.
                raise exc
            return duckdb.connect(self.db_path, read_only=self.read_only)

    def _initialize_schema(self) -> None:
        if self.read_only or self.conn is None:
            return
        schema_path = Path(__file__).resolve().parent / "schema.sql"
        self.conn.execute(schema_path.read_text())

    def execute(self, query: str, params: tuple | None = None):
        if self.conn is None:
            raise RuntimeError("DuckDB is not available (DUCKDB_READ_ONLY mode — use PostgreSQL instead)")
        if params is None:
            return self.conn.execute(query)
        return self.conn.execute(query, params)

    def fetch_df(self, query: str, params: tuple | None = None):
        if self.conn is None:
            raise RuntimeError("DuckDB is not available (DUCKDB_READ_ONLY mode — use PostgreSQL instead)")
        if params is None:
            return self.conn.execute(query).df()
        return self.conn.execute(query, params).df()

    def close(self) -> None:
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass

    def reconnect(self) -> None:
        if self._skip_connection:
            return
        self.conn = self._connect_with_recovery()
        self._initialize_schema()


db_client = DuckDBClient()
