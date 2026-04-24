<div align="center">

# 🌊 BlueSME

**AI-Powered Financial Intelligence for Kenya's Blue Economy**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11-yellow?logo=python)](https://python.org)
[![CrewAI](https://img.shields.io/badge/CrewAI-0.80+-green)](https://crewai.com)
[![Celery](https://img.shields.io/badge/Celery-5.3-brightgreen?logo=celery)](https://docs.celeryq.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io)
[![Base Sepolia](https://img.shields.io/badge/Blockchain-Base_Sepolia-0052FF)](https://base.org)

*Helping Mombasa coastal SMEs — fish traders, boat operators, and marine tourism businesses — log sales, gain AI-driven insights, and generate blockchain-verified funding proof for lenders and grant officers.*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Final Architecture](#-final-architecture)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Development Journey](#-development-journey)
- [Quick Start](#-quick-start)
- [Running in Production (Docker)](#-running-in-production-docker)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Current Status](#-current-status)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)

---

## 🌊 Overview

BlueSME is a full-stack fintech + AI + blockchain platform built for small and medium enterprises operating in coastal Kenya's blue economy. It solves a real problem: SMEs in fisheries, marine tourism, and boat operations are financially invisible — they have no formal records, no credit history, and no way to prove revenue to lenders.

BlueSME gives them:

- **A simple interface** to log daily sales in plain English or Swahili
- **AI agents** that parse, validate, and analyse their financial activity
- **An immutable blockchain record** on Base Sepolia for every transaction
- **A Trust Demonstration Dashboard** allowing non-technical stakeholders to see live activity and system integrity
- **A verifiable Funding Proof report** they can share with any lender or grant officer
- **A Self-Healing Reconciliation Engine** that guarantees zero divergence between the database and the blockchain

---

## 🏗 Final Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER / CLIENT                            │
│                    Next.js Dashboard (Port 3000)                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                               │
│   POST /api/log-sale  │  /api/run-insights  │  /api/generate-proof  │
│         GET /api/job-status  │  GET /api/reconciliation-status      │
│                                                                     │
│   QUEUE_MODE=0 → direct subprocess (legacy / dev)                  │
│   QUEUE_MODE=1 → enqueue to Celery (production)                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTP (internal)
┌────────────────────────▼────────────────────────────────────────────┐
│              FASTAPI QUEUE BRIDGE (Port 8001)                       │
│      /queue/log-sale  │  /queue/run-insights  │  /queue/status/:id  │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Push / Poll
┌────────────────────────▼────────────────────────────────────────────┐
│                    REDIS (Port 6379)                                │
│         Broker: sale_queue │ insights_queue │ proof_queue           │
│             blockchain_queue │ reconcile_queue                      │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Consume
┌────────────────────────▼────────────────────────────────────────────┐
│                  CELERY WORKERS & BEAT SCHEDULER                    │
│   process_sale_task  │  generate_insights_task  │  generate_proof   │
│         blockchain_log_task  │  reconcile_transactions_task         │
└───────┬─────────────────────────┬───────────────────────────────────┘
        │                         │
┌───────▼──────────┐   ┌──────────▼──────────────────────────────────┐
│   CREWAI FLOWS   │   │           POSTGRESQL (Port 5432)             │
│                  │   │  SMEs │ Transactions │ Insights │ Proofs     │
│  SaleLoggingFlow │   │          AgentLogs │ ReconciliationLogs      │
│  InsightsFlow    │   └─────────────────────────────────────────────┘
│  ProofFlow       │
└───────┬──────────┘
        │
┌───────▼──────────────────────────────────────────────────────────────┐
│                  AI AGENTS (Google Gemini / OpenAI)                  │
│   Sales Agent  │  Finance Agent  │  Insights Agent  │  Blockchain    │
└───────┬──────────────────────────────────────────────────────────────┘
        │ web3
┌───────▼──────────────────────────────────────────────────────────────┐
│              BASE SEPOLIA BLOCKCHAIN                                 │
│           BlueSMETracker Smart Contract                              │
│           logActivityFor() │ getActivities() │ generateProof()       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🖥 Trust Demonstration Dashboard
- **Real-time KPI cards** — revenue, sales count, on-chain logs, and health score
- **System Integrity Monitor** — Live feedback from the Reconciliation Engine
- **Activity timeline** — Framer Motion-animated feed of all distributed agent actions
- **Financial Proof output** — Instantly generates a clean, ZK-like audit certificate
- **SaaS Glassmorphism Design** — built with Tailwind v4, Lucide icons, and deep dark-mode aesthetics

### 🤖 AI Agent System (CrewAI)
| Agent | Role |
|---|---|
| **Sales Agent** | Parses raw SME messages (English/Swahili) into structured JSON |
| **Finance Agent** | Validates amounts, categories, and KES realism before on-chain write |
| **Insights Agent** | Runs evening analysis — trends, pricing opportunities, risk alerts |
| **Blockchain Agent** | Writes confirmed data to Base Sepolia and generates Funding Proof |

### ⚡ Queue-Driven Backend
- Non-blocking API — returns `job_id` immediately on submission
- 4 dedicated task queues for priority routing
- Retryable tasks with exponential back-off (3–5 retries)
- Full execution audit trail in `AgentLogs` table

### ⛓ Blockchain Integration
- Every sale logged as an immutable record on **Base Sepolia**
- Async `blockchain_log_task` stores `tx_hash` after confirmation
- **Funding Proof** reports: PDF-equivalent with Basescan verification URL and QR code
- Smart contract: `BLueSMETracker.sol`

### 🔒 Authentication & Safety
- JWT-based auth with SME-scoped access control
- Strict SHA-256 idempotency keys block duplicate submissions at the DB level
- Strict Pydantic schema validation on all agent inputs and outputs
- LLM output parsing with 3-layer fallback strategy

### 🔄 Reconciliation Engine
- Distributed async periodic task running on **Celery Beat**
- Cross-references PostgreSQL (source of truth) with Base Sepolia state
- Automatically flags `missing_on_chain`, `missing_in_db`, and `data_mismatch`
- Safe auto-repair capabilities with Redis distributed locks to prevent overlap

### ⚙️ Test Mode vs Live Mode
| | Test Mode (`BLUESME_TEST_MODE=1`) | Live Mode (`BLUESME_TEST_MODE=0`) |
|---|---|---|
| LLM | Deterministic mock outputs | Real Gemini/OpenAI calls |
| Blockchain | In-memory mock store | Base Sepolia RPC |
| DB | Still writes to PostgreSQL | Writes to PostgreSQL |
| Speed | Instant | 5–120 seconds per flow |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript 5 |
| **Styling** | Tailwind CSS v4, Framer Motion |
| **Charts** | Recharts |
| **API Routes** | Next.js API Routes (TypeScript) |
| **Agent Framework** | CrewAI 0.80+, Python 3.11 |
| **LLM Providers** | Google Gemini 1.5 Pro, OpenAI GPT-4o (fallback) |
| **Task Queue** | Celery 5.3, Redis 7 |
| **Queue Bridge** | FastAPI + Uvicorn |
| **Database** | PostgreSQL 16, SQLAlchemy 2.0 |
| **Authentication** | PyJWT (HS256) |
| **Blockchain** | Base Sepolia, Web3.py |
| **Smart Contract** | Solidity (BLueSMETracker.sol) |
| **Containerization** | Docker, Docker Compose |

---

## 🗺 Development Journey

BlueSME was built in 8 iterative phases, each adding a meaningful layer:

| Phase | What Was Built |
|---|---|
| **1 — Frontend Foundation** | Next.js + TypeScript + Tailwind setup, page scaffolding, global layout |
| **2 — UI Features** | KPI cards, charts, timeline, toasts, animations, all 4 pages |
| **3 — API Layer** | Next.js API routes, Python subprocess bridge (`runFlow.ts`) |
| **4 — Agent System** | 4 CrewAI agents, 3 flows (Sale/Insights/Proof), task factory pattern |
| **5 — Test Mode** | `BLUESME_TEST_MODE`, deterministic mocks, mock blockchain store |
| **6 — Backend Upgrade** | PostgreSQL models, Celery/Redis queue, FastAPI bridge, JWT auth, structured logging, strict validation |
| **7 — DevOps** | Dockerfiles, docker-compose, `.env.example`, backend requirements |
| **8 — Idempotency & Safety** | SHA-256 idempotency constraint, race-condition fixes, Smart Regex Test Mode |
| **9 — Integrity & Dashboard** | Automated Reconciliation Engine (Celery Beat), Glassmorphism Trust UI Dashboard |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (for PostgreSQL + Redis)

### 1. Clone and configure

```bash
git clone https://github.com/<you>/bluesme.git
cd bluesme
cp .env.example .env
# Edit .env — set your API keys
```

### 2. Install dependencies

```bash
# Python
pip install -r requirements.txt -r requirements.backend.txt

# Node
npm install
```

### 3. Start infrastructure (PostgreSQL + Redis only)

```bash
docker compose up postgres redis -d
```

### 4. Initialize the database

```bash
python scripts/init_db.py
```

### 5. Start all services

Open **5 separate terminals**:

```bash
# Terminal 1 — Celery worker
celery -A backend.tasks.celery_app.celery_app worker \
  --loglevel=info \
  --queues=sale_queue,insights_queue,proof_queue,blockchain_queue,reconcile_queue,default \
  --concurrency=4

# Terminal 2 — Celery Beat (Reconciliation Engine)
celery -A backend.tasks.celery_app.celery_app beat --loglevel=info

# Terminal 3 — FastAPI queue bridge
uvicorn backend.services.queue_bridge:app --port 8001 --reload

# Terminal 4 — Next.js
npm run dev

# Terminal 5 — (optional) Celery Flower monitoring
pip install flower && celery -A backend.tasks.celery_app.celery_app flower --port=5555
```

Open **http://localhost:3000** — you should see the dashboard.

> **Note:** By default `QUEUE_MODE=0` — the system runs flows directly without Celery. Set `QUEUE_MODE=1` only when the worker and bridge are running.

---

## 🐳 Running in Production (Docker)

```bash
# Build and start everything
docker compose up --build -d

# Scale workers for high load
docker compose up --scale worker=4 -d

# Initialize DB (first time only)
docker compose exec worker python scripts/init_db.py

# View logs
docker compose logs -f worker bridge
```

---

## 🔧 Environment Variables

Full list in `.env.example`. Key variables:

| Variable | Default | Description |
|---|---|---|
| `BLUESME_TEST_MODE` | `1` | `1` = mock mode, `0` = real LLM + blockchain |
| `BLUESME_MODEL` | `gemini/gemini-1.5-pro` | LLM model string |
| `GOOGLE_API_KEY` | — | Google AI API key |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PASSWORD` | `bluesme_secret` | PostgreSQL password |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `QUEUE_MODE` | `0` | `1` = Celery queue, `0` = direct subprocess |
| `QUEUE_BRIDGE_URL` | `http://localhost:8001` | FastAPI bridge URL |
| `JWT_SECRET` | — | Long random string for JWT signing |
| `CONTRACT_ADDRESS` | — | Deployed BLueSMETracker address |
| `RPC_URL` | `https://sepolia.base.org` | Base Sepolia RPC endpoint |

---

## 📡 API Reference

### Existing Endpoints (unchanged shape)

| Method | Endpoint | Body | Response |
|---|---|---|---|
| `POST` | `/api/log-sale` | `{smeAddress, saleMessage}` | `{output, testMode}` or `{job_id, status}` |
| `POST` | `/api/run-insights` | `{smeAddress, isWeekEnd?}` | `{output, testMode}` or `{job_id, status}` |
| `POST` | `/api/generate-proof` | `{smeAddress, smeName, smeCategory, days}` | `{output, testMode}` or `{job_id, status}` |

### New Endpoint

| Method | Endpoint | Query | Response |
|---|---|---|---|
| `GET` | `/api/job-status` | `?id=<job_id>` | `{job_id, status, ready, output, meta}` |

### Queue Mode Behaviour

When `QUEUE_MODE=1`:
- All POST endpoints return `202 Accepted` with `{job_id, status: "queued"}`
- Add header `X-Wait-For-Result: true` to wait inline for result (up to 120s)
- Poll `GET /api/job-status?id=<job_id>` for async result

### Job Status Values

`queued` → `running` → `success` | `failure` | `retry`

---

## 📁 Project Structure

```
bluesme/
├── agents/                    # CrewAI agent definitions
│   ├── sales_agent.py
│   ├── finance_agent.py
│   ├── insights_agent.py
│   ├── blockchain_agent.py
│   └── tasks.py               # Task factory functions
├── backend/                   # Production backend modules
│   ├── db/
│   │   ├── models.py          # SQLAlchemy ORM (5 tables)
│   │   └── session.py         # Session management
│   ├── tasks/
│   │   ├── celery_app.py      # Celery + Redis config
│   │   └── tasks.py           # 4 Celery tasks
│   ├── services/
│   │   ├── queue_bridge.py    # FastAPI bridge server
│   │   └── auth.py            # JWT authentication
│   └── utils/
│       ├── logger.py          # Structured logging
│       └── validators.py      # Pydantic schemas
├── contracts/                 # Blockchain integration
│   ├── BLueSMETracker.sol
│   ├── mock_blockchain.py
│   └── contract_config.py
├── flows/                     # CrewAI flow definitions
│   ├── sale_logging_flow.py
│   ├── evening_insights_flow.py
│   └── funding_proof_flow.py
├── frontend/                  # React components and pages
│   ├── components/            # KPICard, Chart, Timeline, etc.
│   ├── context/AppContext.tsx
│   ├── hooks/useApi.ts
│   ├── pages/                 # Page implementations
│   └── services/api.ts
├── lib/server/
│   ├── runFlow.ts             # Python subprocess bridge
│   └── queue.ts               # Queue utilities
├── pages/                     # Next.js router
│   ├── _app.tsx
│   ├── _document.tsx
│   ├── api/                   # API routes
│   └── *.tsx                  # Re-exports from frontend/pages/
├── scripts/
│   ├── run_flow.py            # Flow CLI runner
│   └── init_db.py             # DB schema initializer
├── tools/                     # CrewAI blockchain tools
├── styles/globals.css
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── .env.example
├── requirements.txt
└── requirements.backend.txt
```

---

## 📊 Current Status

| Area | Status | Notes |
|---|---|---|
| Frontend dashboard | ✅ Complete | "Trust Demo" UI with Glassmorphism & Framer Motion |
| Next.js API routes | ✅ Complete | Queue modes, job-status, and reconciliation-status |
| CrewAI agents (4) | ✅ Complete | Sales, Finance, Insights, Blockchain |
| Test mode | ✅ Complete | Smart Regex Parser, highly robust and deterministic |
| PostgreSQL models | ✅ Complete | 6 tables (including ReconciliationLogs) with unique constraints |
| Celery queue system | ✅ Complete | Redis-backed, idempotent, tested against race conditions |
| Reconciliation Engine | ✅ Complete | Scheduled Celery Beat lock-safe auto-auditor |
| FastAPI bridge | ✅ Implemented | Running |
| JWT authentication | ✅ Implemented | Wallet-signature verification pending |
| Blockchain (live) | ⚠️ Partial | Mock blockchain in test mode; live Base Sepolia integration wired but not audited |
| CI/CD pipeline | ❌ Not yet | GitHub Actions planned |
| Production deployment | ❌ Not yet | Infrastructure ready; deployment TBD |
| Alembic migrations | ❌ Not yet | `init_db()` used currently |

---

## 🗓 Roadmap

### Near-term
- [ ] Replace `BLUESME_TEST_MODE` subprocess flag with proper config injection
- [ ] Add EIP-191 wallet signature verification to auth flow
- [ ] Implement Alembic migrations for schema evolution
- [ ] Add GitHub Actions CI (lint, type-check, test)
- [ ] Add end-to-end tests for all 3 API flows

### Mid-term
- [ ] Mobile-first PWA with push notifications for daily insights
- [ ] M-Pesa transaction import via Daraja API
- [ ] Multi-SME dashboard with role-based access
- [ ] Live Base Sepolia deployment with contract audit
- [ ] Celery Flower monitoring dashboard in docker-compose

### Long-term
- [ ] Credit scoring model trained on on-chain activity
- [ ] Direct integration with KCB/Equity Bank loan APIs
- [ ] Offline-capable mobile app for low-connectivity fishing communities
- [ ] Multi-language support (Swahili, Giriama, Digo)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Follow the commit format: `type(scope): description` (see commit plan)
4. Open a pull request with a clear description

**Commit types:** `feat` | `fix` | `refactor` | `chore` | `docs` | `test`

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built for the Blue Economy of coastal Kenya 🌊
</div>
