# Telecom NOC Copilot

Agentic AI Telecom Network Operations Center (NOC) Copilot.

This repository currently contains the **folder and scaffolding structure only**. Application logic, dependencies, and AWS resources are intentionally not implemented yet.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy |
| Database | PostgreSQL |
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
├── scripts/           # Utility scripts
├── docs/              # Documentation
└── .github/workflows/ # CI/CD workflow placeholders
```

## Getting started

1. Copy `.env.example` to `.env` and fill in local values (never commit secrets).
2. Implement services and Dockerfiles under each package directory.
3. Use GitHub Actions workflows under `.github/workflows/` for CI/CD once configured.

## CI/CD

Workflow placeholders:

- `frontend-ci.yml` — frontend validation and build
- `backend-ci.yml` — Python checks and pytest
- `docker-build.yml` — Docker image build validation
- `terraform-check.yml` — Terraform formatting and validation
- `deploy-aws.yml` — AWS ECR / ECS Fargate deployment (OIDC or Secrets; no hardcoded credentials)
