# Telecom NOC Copilot

Agentic AI Telecom Network Operations Center (NOC) Copilot.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy 2.x |
| Database | PostgreSQL (local Docker or AWS RDS) via psycopg and Alembic |
| AI | Amazon Bedrock, AgentCore Runtime, AgentCore Gateway, LangGraph |
| RAG | Amazon Bedrock Knowledge Bases, Amazon S3 |
| Tools | MCP |
| Infrastructure | Docker, Docker Compose, Terraform, AWS ECS/Fargate, ECR |
| Testing | pytest, frontend test structure |
| CI/CD | GitHub Actions |

## Project layout

```
telecom-noc-copilot/
├── frontend/          # React + TypeScript + Vite UI
├── backend/           # FastAPI application
├── mock-services/     # Simulated OSS / telemetry / deployment / ticketing APIs
├── agent/             # LangGraph agent nodes, tools, prompts, runtime
├── rag/               # Ingestion, retrieval, evaluation
├── mcp-server/        # MCP tool server
├── data/              # Synthetic data, runbooks, scenarios
├── evaluation/        # Evaluation datasets and harnesses
├── infrastructure/    # Terraform modules and environments
├── scripts/           # Utility scripts (including database seed wrapper)
├── docs/              # Documentation
└── .github/workflows/ # CI/CD workflow placeholders
```

## Getting started

1. Copy `.env.example` to `.env` and fill in local values (never commit secrets).
2. Install backend dependencies from `backend/` (`pip install -r requirements.txt -r requirements-dev.txt`).
3. Install frontend dependencies from `frontend/` (`npm install`).
4. Optional: start local PostgreSQL (see below). Without `DATABASE_URL`, mock OSS APIs use the JSON files in `data/`.

### Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` and `GET /health`.

### Frontend

```bash
cd frontend
npm run dev
```

### Local PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
docker logs telecom-noc-postgres
cd backend
alembic upgrade head
python -m app.db.seed --counts
pytest -q
```

Stop the database with `docker compose stop postgres`. Do not use `docker compose down -v` as routine cleanup; it deletes the persisted volume.

Database configuration, Alembic, seed commands, AWS RDS (Secrets Manager + TLS), networking requirements, and troubleshooting are in [docs/database.md](docs/database.md).

Local Docker and RDS share the same SQLAlchemy models. Change `DATABASE_URL` (or `DATABASE_SECRET_ARN`) to switch; no code change is required. The backend must have an authorized network route and security-group access to RDS. Do not make the instance publicly accessible.

## CI/CD

Workflow placeholders:

- `frontend-ci.yml` — frontend validation and build
- `backend-ci.yml` — Python checks and pytest
- `docker-build.yml` — Docker image build validation
- `terraform-check.yml` — Terraform formatting and validation
- `deploy-aws.yml` — AWS ECR / ECS Fargate deployment (OIDC or Secrets; no hardcoded credentials)
