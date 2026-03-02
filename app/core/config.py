import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DUCKDB_PATH = DATA_DIR / "durai_pricing.duckdb"

CSV_CHUNK_SIZE = 5000

DB_ENGINE = os.getenv("DB_ENGINE", "duckdb").lower()
PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql://postgres:postgres@127.0.0.1:5432/duraipricing",
)
SYNC_BATCH_SIZE = int(os.getenv("SYNC_BATCH_SIZE", "5000"))
