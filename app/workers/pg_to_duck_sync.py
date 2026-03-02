import argparse
import time

from app.services.sync_service import run_sync_once


def main():
    parser = argparse.ArgumentParser(description="Sync PostgreSQL transactional tables into DuckDB analytics mirror.")
    parser.add_argument("--once", action="store_true", help="Run one sync pass and exit.")
    parser.add_argument("--interval", type=int, default=30, help="Polling interval in seconds for continuous mode.")
    args = parser.parse_args()

    if args.once:
        print(run_sync_once())
        return

    while True:
        try:
            print(run_sync_once())
        except Exception as exc:
            print({"status": "error", "error": str(exc)})
        time.sleep(max(5, args.interval))


if __name__ == "__main__":
    main()
