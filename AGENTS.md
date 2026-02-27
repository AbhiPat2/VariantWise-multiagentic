# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

VariantWise is a 3-service application (no monorepo tooling). See `README.md` for full documentation.

| Service | Dir | Port | Stack |
|---------|-----|------|-------|
| Frontend | `frontend/` | 3000 | Next.js 15 (Turbopack) |
| Backend | `backend/` | 3001 | Express.js, MySQL |
| Model | `model/` | 8000 | Flask, sentence-transformers, OpenAI, AWS Bedrock |

### Running services

**MySQL** must be started manually before the backend:
```
sudo mkdir -p /var/run/mysqld && sudo chown mysql:mysql /var/run/mysqld
sudo mysqld --user=mysql --datadir=/var/lib/mysql &
sleep 3
sudo chmod 755 /var/run/mysqld
```

**Backend** (requires MySQL running):
```
source ~/.nvm/nvm.sh && nvm use 20
cd backend && npx nodemon index.js
```
Note: `nodemon` is a devDependency; use `npx nodemon` to run it.

**Model** (requires Python venv):
```
cd model && source .venv/bin/activate && python app.py
```
The model service downloads the sentence-transformer model on first run (~260MB). Subsequent starts are faster due to cache.

**Frontend**:
```
source ~/.nvm/nvm.sh && nvm use 20
cd frontend && npm run dev
```

### Environment files

Three `.env` files are needed (all gitignored):
- `backend/.env` — MySQL creds, session secret, frontend URL, port
- `model/.env` — AWS Bedrock + OpenAI API keys (placeholders work for startup; real keys needed for AI features)
- `frontend/.env.local` — `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001` and `NEXT_PUBLIC_MODEL_URL=http://localhost:8000`

### Lint / Build / Test

- **Lint**: `cd frontend && npm run lint` (requires ESLint 8 + `.eslintrc.json` with `next/core-web-vitals`)
- **Build**: `cd frontend && npm run build`
- No automated test suite exists in this repository.

### Gotchas

- Node.js 20 is required (`.nvmrc`). The VM default may be different; always run `nvm use 20`.
- The backend `env.js` looks for `.env` or `_env` in the backend directory; it does not use `dotenv` package.
- The backend's DB pool connection error on startup is non-fatal — the server still starts and retries.
- The model service's `GRAPH_PIPELINE_ENABLED` flag defaults to `True`; pipeline init loads all 8 agents at startup.
- Google OAuth is optional; the app works with email/password auth when `GOOGLE_CLIENT_ID` is not set.
- The Flask model service uses a deprecated `BedrockChat` import from langchain-community; this is a warning, not an error.
