def run_sync_once(batch_size: int = 0) -> dict:
    return {"status": "skipped", "reason": "Sync service is decommissioned. PostgreSQL is the unified source of truth."}
