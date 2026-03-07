# Master Prompt: Build, Setup, and Deploy DuraiPricingTool End-to-End

Use this prompt with an engineering assistant to execute a complete setup from scratch through production deployment.

---

You are a senior DevOps + full-stack engineer.  
Set up and deploy **DuraiPricingTool** end-to-end, with production-grade practices.

## Project Context
- Backend: FastAPI (`app.main:app`)
- Frontend: React + Vite (`frontend/`)
- Analytics DB: DuckDB
- Optional hybrid mode: PostgreSQL for transactional APIs + DuckDB for analytics
- Repo root: `/home/waheed/DuraiPricingTool`

## Requirements (must satisfy all)
1. Environment + dependencies
- OS: Linux (Ubuntu preferred)
- Python: 3.11+ (venv-based)
- Node.js: 20+ and npm
- Install backend dependencies from `requirements.txt`:
  - `fastapi==0.116.1`
  - `uvicorn==0.35.0`
  - `duckdb==1.3.2`
  - `pandas==2.3.2`
  - `pydantic==2.11.7`
  - `python-multipart==0.0.20`
  - `numpy==2.3.2`
  - `httpx==0.28.1`
  - `psycopg[binary]==3.2.9`
- Install frontend dependencies from `frontend/package.json`

2. Local development setup
- Create and activate virtualenv at `.venv`
- Install Python deps
- Install frontend deps in `frontend/`
- Start backend on `0.0.0.0:9000`
- Start frontend on `0.0.0.0:5173`
- If backend is remote/non-default, set `VITE_API_BASE_URL`

3. Functional validation
- Verify backend health endpoint: `GET /health`
- Verify frontend URL loads on `5173`
- Seed sample data:
  - `POST /admin/seed/sample-data?row_count=10000`
  - `POST /admin/seed/workflow-rules`
- Validate key flows:
  - `GET /analytics/waterfall`
  - `POST /quotes/calculate`
  - `POST /chatbot/ask`
- Provide exact curl commands and expected success signals

4. Production deployment
- Build frontend (`npm run build`)
- Serve frontend through Nginx (static files)
- Run backend with systemd service using uvicorn
- Configure reverse proxy:
  - `/api` -> FastAPI backend (`127.0.0.1:9000`)
  - `/` -> frontend static app
- Open firewall for HTTP/HTTPS only
- Enable HTTPS with Let’s Encrypt (certbot)
- Enable service auto-start on reboot

5. Optional hybrid DB mode
- Support env vars:
  - `DB_ENGINE=hybrid`
  - `PG_DSN=postgresql://postgres:postgres@127.0.0.1:5432/duraipricing`
- Run sync job once: `python -m app.workers.pg_to_duck_sync --once`
- Continuous sync: `python -m app.workers.pg_to_duck_sync --interval 30`
- Validate admin sync endpoint: `POST /admin/sync/run-once`

6. Reliability and operations
- Log file paths for backend and frontend
- Restart policies in systemd
- Include troubleshooting for:
  - Port conflicts (`9000`, `5173`)
  - CORS/API base URL mismatch
  - service starts but endpoint not reachable
- Include rollback steps for bad deploy

## Deliverables Format
Return your answer in these sections:
1. `Prerequisites`
2. `Install and Local Setup`
3. `Run Commands`
4. `Validation Checklist`
5. `Production Deployment (Nginx + systemd + SSL)`
6. `Hybrid PostgreSQL + DuckDB Setup (Optional)`
7. `Ops Runbook (logs, restart, health checks, rollback)`
8. `Final Acceptance Criteria`

## Execution Rules
- Use concrete commands, not placeholders unless unavoidable.
- Prefer idempotent steps.
- Show commands in copy-paste-ready blocks.
- Explain any assumption explicitly.
- At the end, provide:
  - active URLs
  - active services
  - exact commands to verify system health after reboot.

