# Althy — Assistant immobilier suisse

Stack : **Next.js 14** (frontend) + **FastAPI** (backend) + **Supabase** (auth + storage) + **PostgreSQL** + **Redis/Celery** + **Claude AI**

---

## Prérequis

| Outil | Version minimale |
|---|---|
| Node.js | 20+ |
| Python | 3.12+ |
| Docker Desktop | 4.x |
| make | (Git Bash / WSL / Linux / macOS) |

---

## Setup local (avec Docker)

### 1. Cloner le repo

```bash
git clone <repo-url>
cd immohub
```

### 2. Variables d'environnement

**Backend** — copier et remplir :
```bash
cp backend/.env.example backend/.env
```

```env
# backend/.env
APP_NAME=Althy
APP_ENV=development
DEBUG=true
SECRET_KEY=<génère avec: python -c "import secrets; print(secrets.token_hex(32))">
ALLOWED_ORIGINS=http://localhost:3000

# PostgreSQL (remplacé par le container docker en dev)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/immohub

# Supabase — obligatoire pour l'auth JWT
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret>

# Redis (remplacé par le container docker en dev)
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# IA
ANTHROPIC_API_KEY=sk-ant-...

# Email (optionnel)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAILS_FROM=noreply@althy.ch
```

**Frontend** — copier et remplir :
```bash
cp frontend/.env.local.example frontend/.env.local
```

```env
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Lancer l'environnement

```bash
make dev-build    # première fois (build les images Docker)
make dev          # fois suivantes
```

Services disponibles :
| Service | URL |
|---|---|
| Frontend Next.js | http://localhost:3000 |
| Backend FastAPI | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/api/docs |
| Health check | http://localhost:8000/api/health |

### 4. Migrations de base de données

```bash
# Appliquer toutes les migrations
make migrate

# Créer une nouvelle migration
make migrate-create MSG="add column xyz"

# Rollback
make migrate-down
```

---

## Setup local (sans Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # Windows Git Bash
# source venv/bin/activate         # macOS/Linux

pip install -r requirements.txt

# Lancer FastAPI
uvicorn app.main:app --reload

# Lancer Celery worker (terminal séparé)
celery -A app.tasks.celery_app worker --loglevel=info

# Lancer Celery beat (terminal séparé)
celery -A app.tasks.celery_app beat --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Tests

```bash
make test        # pytest rapide
make test-v      # verbose
make test-cov    # avec couverture
```

---

## Lint

```bash
make lint              # backend (ruff + mypy) + frontend (eslint + tsc)
make lint-backend      # ruff check + mypy uniquement
make lint-frontend     # eslint + typescript check uniquement
make format            # auto-fix backend (ruff)
```

---

## Architecture

```
immohub/
├── backend/                    # FastAPI + SQLAlchemy async
│   ├── app/
│   │   ├── core/              # config, database, security
│   │   ├── models/            # SQLAlchemy ORM (13 tables)
│   │   ├── schemas/           # Pydantic v2 schemas
│   │   ├── routers/           # API endpoints
│   │   ├── services/          # Business logic + AI service
│   │   └── tasks/             # Celery tasks
│   ├── alembic/               # Migrations DB
│   ├── tests/                 # pytest
│   ├── Dockerfile.dev
│   ├── Procfile               # Railway: web + worker + beat
│   ├── railway.toml           # Railway config
│   └── requirements.txt
├── frontend/                  # Next.js 14 App Router
│   ├── src/
│   │   ├── app/               # Pages (dashboard, auth)
│   │   ├── components/        # Composants React (+ AICopilot)
│   │   └── lib/               # API client, hooks, types, stores
│   ├── Dockerfile.dev
│   └── vercel.json            # Vercel config
├── .github/workflows/ci.yml   # CI/CD GitHub Actions
├── docker-compose.yml         # Dev local (6 services)
└── Makefile
```

### Stack complète

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS v3, React Query v5, Zustand |
| Backend | FastAPI 0.115, Python 3.12, SQLAlchemy 2.0 async (asyncpg) |
| Auth | Supabase Auth (JWT HS256 vérifié côté backend) |
| Base de données | PostgreSQL 16 (Supabase en prod, container local en dev) |
| Cache / Queue | Redis 7 + Celery 5 (worker + beat) |
| IA | Anthropic Claude Sonnet — annonces, scoring locataire, devis, chat SSE, anomalies |
| Storage | Supabase Storage (images biens, documents) |
| Paiements | Stripe |
| Déploiement | Vercel (frontend) + Railway (backend) |

---

## Déploiement

### GitHub Secrets requis

| Secret | Description |
|---|---|
| `RAILWAY_TOKEN` | Token Railway (`railway login` → Settings → Tokens) |
| `VERCEL_TOKEN` | Token Vercel (vercel.com → Settings → Tokens) |
| `VERCEL_ORG_ID` | ID de l'organisation Vercel |
| `VERCEL_PROJECT_ID` | ID du projet Vercel (`.vercel/project.json` après `vercel link`) |

### Railway (backend)

1. Créer un projet Railway
2. Ajouter le service **backend** pointant sur `./backend`
3. Configurer les variables d'environnement (DATABASE_URL, SUPABASE_*, ANTHROPIC_API_KEY, etc.)
4. Ajouter un service **PostgreSQL** et **Redis** depuis le catalogue Railway
5. Ajouter le service **worker** avec start command : `celery -A app.tasks.celery_app worker --loglevel=info`
6. Ajouter le service **beat** avec start command : `celery -A app.tasks.celery_app beat --loglevel=info`

Le health check est disponible sur `GET /api/health`.

### Vercel (frontend)

1. Importer le repo sur vercel.com → sélectionner le dossier `frontend/`
2. Configurer les variables d'environnement :
   - `NEXT_PUBLIC_API_URL` → URL Railway du backend
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL`
3. Lier le projet localement : `cd frontend && vercel link` (génère `.vercel/project.json`)

Les valeurs `@immohub-api-url` etc. dans `vercel.json` sont des références aux variables du dashboard Vercel.

### CI/CD (GitHub Actions)

Sur chaque **push** ou **PR** vers `main` :
- ✅ Backend : ruff lint → ruff format → mypy → pytest
- ✅ Frontend : eslint → tsc → next build

Sur **merge** vers `main` :
- 🚀 Deploy backend → Railway
- 🚀 Deploy frontend → Vercel

---

## Commandes utiles

```bash
make help           # liste toutes les commandes
make shell-backend  # shell dans le container backend
make shell-db       # psql dans le container postgres
make clean          # supprime les volumes Docker (⚠️ efface les données locales)
```
