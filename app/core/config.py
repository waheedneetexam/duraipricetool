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

AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "0").lower() in {"1", "true", "yes"}
AUTH_SECRET = os.getenv("AUTH_SECRET", "durai-pricing-dev-secret-change-me")
ACCESS_TOKEN_TTL_MINUTES = int(os.getenv("ACCESS_TOKEN_TTL_MINUTES", "60"))
REFRESH_TOKEN_TTL_DAYS = int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "7"))
AUTH_BOOTSTRAP_TENANT = os.getenv("AUTH_BOOTSTRAP_TENANT", "default")
AUTH_BOOTSTRAP_EMAIL = os.getenv("AUTH_BOOTSTRAP_EMAIL", "admin@durai.local")
AUTH_BOOTSTRAP_PASSWORD = os.getenv("AUTH_BOOTSTRAP_PASSWORD", "Admin@123")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
