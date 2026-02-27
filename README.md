# VariantWise — Multi-Agentic Car Recommendation System

**VariantWise** is an AI-powered car recommendation platform that helps users discover the perfect car **variant** tailored to their needs. It combines a multi-agent reasoning pipeline with real-world driving insights to simplify the complex car selection process into a conversational, personalized experience.

The system builds a custom preference profile for each user by analyzing their inputs through semantic embeddings, rule-based scoring, and a coalition of specialized AI agents. Each agent handles a distinct part of the recommendation pipeline — from extracting preferences to pruning variants, negotiating trade-offs, and generating natural-language explanations. Recommendations are delivered through a consultant-style chat interface powered by Retrieval-Augmented Generation (RAG) and a shared knowledge graph.

---

## Project Structure

```
VariantWise/
├── backend/          Express.js API — auth, sessions, user management
├── data/             Raw specs, reviews, and final_dataset.csv
├── evaluation/       Evaluation scripts and compliance reports
├── frontend/         Next.js frontend — consultant UI, dashboard, auth flows
├── model/            Flask ML service — multi-agent pipeline & recommendations
│   └── agents/       Individual agent modules (9 agents)
└── scraper/          Scraping scripts for car specs and reviews
```

| Folder | Stack | Description |
|---|---|---|
| `backend/` | Node.js, Express, MySQL, Passport | Authentication (email + Google OAuth), session management, API proxy |
| `frontend/` | Next.js 15, Tailwind CSS, Radix UI, Framer Motion | Consultant chat flow, dashboard, variant detail pages, auth pages |
| `model/` | Python, Flask, Sentence-Transformers, OpenAI, AWS Bedrock | Multi-agent recommendation pipeline, knowledge graph, RAG-based Q&A |
| `model/agents/` | Python | 9 specialized agents: Preference Extraction, Variant Pruning, Car Matchmaker, Trade-Off Negotiator, Context Awareness, Validation & Sanity, Explanation, Advanced Reasoning |
| `data/` | CSV, TXT | Scraped specs (`final_dataset.csv`), expert reviews per model |
| `evaluation/` | Python | Recommendation evaluation, control compliance testing |
| `scraper/` | Python | Spec scraper, review scraper, data merge scripts |

---

## Prerequisites

- **Node.js** v20+ (see `.nvmrc`)
- **npm**
- **Python** 3.8+
- **pip**
- **MySQL** server (running and accessible)
- **AWS account** with Amazon Bedrock access (Mistral model) + IAM permissions
- **OpenAI API key** (for agent-based reasoning pipeline)

---

## Environment Files

This project uses 3 environment files that contain secrets and must **never be committed to git**. Get these from a team member via a secure channel (DM, password manager, etc.).

### `backend/.env`

```dotenv
# MySQL Database
DB_HOST=your_mysql_host
DB_USERNAME=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=your_mysql_database_name
DB_PORT=3306

# Session Secret
Secret_Key=your_strong_session_secret

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Google OAuth (optional — app works without it)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Server
PORT=3001
NODE_ENV=development
```

### `model/.env`

```dotenv
# AWS Bedrock (for LLM inference)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region

# OpenAI (for agent reasoning pipeline)
OPENAI_API_KEY=your_openai_api_key
```

### `frontend/.env.local`

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_MODEL_URL=http://localhost:8000
```

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/AbhiPat2/VariantWise-multiagentic.git
cd VariantWise-multiagentic
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` with the values from your team (see template above).

**Database setup:**
- Ensure your MySQL server is running.
- Create the database specified in your `.env`.
- Tables are auto-created/managed by the app based on `backend/models/user.js`.

**Start the backend:**

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Backend runs at: **http://localhost:3001**

### 3. Model Setup

```bash
cd ../model
python -m venv .venv
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

Create `model/.env` with the values from your team (see template above).

**Required data files:**
- `data/final_dataset.csv` must exist (included in repo)
- `data/reviews/` directory must exist with review text files (included in repo)

**Start the Flask server:**

```bash
python app.py
```

Model server runs at: **http://localhost:8000**

### 4. Frontend Setup

```bash
cd ../frontend
npm install
```

Create `frontend/.env.local` with the values above.

**Start the frontend:**

```bash
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## Running the Full Application

Start all three servers (each in its own terminal):

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Model
cd model && source .venv/bin/activate && python app.py

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## Multi-Agent Architecture

The recommendation pipeline uses 9 specialized agents that communicate through a shared knowledge graph:

| Agent | Role |
|---|---|
| **Preference Extraction** | Parses natural language input into structured preference vectors |
| **Variant Pruning** | Filters out variants that violate hard constraints (budget, fuel type, etc.) |
| **Car Matchmaker** | Scores remaining variants against the user's preference profile |
| **Trade-Off Negotiator** | Identifies and resolves conflicting preferences |
| **Context Awareness** | Incorporates conversation history and session context |
| **Validation & Sanity** | Cross-checks recommendations against data for consistency |
| **Explanation** | Generates human-readable reasoning for each recommendation |
| **Advanced Reasoning** | Handles complex multi-criteria decision making |

Agents are orchestrated via `model/recommendation_pipeline.py` and connected to AgentLightning for training and tracing (`model/agent_lightning_bridge.py`).

---

## Scraper (Data Collection)

If you need to re-scrape car data:

```bash
cd scraper
python main.py           # Scrape technical specs
python reviews.py        # Scrape expert reviews
python merge_specs.py    # Merge into final_dataset.csv
```

The master list of cars is defined in `scraper/car_models.json`.

---

## Evaluation

```bash
cd evaluation
python run_eval.py                    # Run recommendation evaluation
python control_compliance_eval.py     # Run control compliance checks
```

---

## License

This project is licensed under the [MIT License](LICENSE).
