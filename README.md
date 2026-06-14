# Advanced DevSecOps & AI vulnerability Orchestrator (RAG System)

A state-of-the-art DevSecOps Security Dashboard and AI-driven Vulnerability Orchestrator. The system is designed to automate the ingestion, analysis, risk assessment, and remediation planning of Common Vulnerabilities and Exposures (CVEs) using a multi-agent orchestrated pipeline.

The repository includes a modern React dashboard, an Express.js & MongoDB/Mongoose API server, a Dockerized Python FastAPI microservice for local embeddings, Qdrant vector database for RAG chat search, and a continuous delivery pipeline (GitHub Actions) deploying to containerized AWS EC2 environments.

---

## ✨ Core Features & Capabilities

* **🤖 Multi-Step AI Agent Orchestrator:** Sequentially executes four isolated steps to process raw vulnerability signatures:
  1. `vulnerability-analysis` (Structured extraction)
  2. `risk-assessment` (Business impact & custom severity scoring)
  3. `remediation-planning` (Remediation guidance)
  4. `orchestrator-summary` (Aggregated executive overview)
* **📚 RAG Security Chat:** Real-time chat client connected to a **Qdrant Vector DB** instance. Users can query security databases in natural language, retrieving contextually relevant patches, advisories, and system warnings.
* **📊 Analytics Dashboard:** Interactive data dashboard built with React, Tailwind CSS, and Recharts, presenting real-time risk profiles, severity distribution, and filterable system scans.
* **🐍 High-Performance Embedding Microservice:** A dedicated Python FastAPI microservice that runs PyTorch and HuggingFace's `BAAI/bge-small-en-v1.5` transformer model, producing 384-dimensional dense vectors on the CPU.
* **🌐 Production-Optimized Caching & Proxy Handling:** Designed to run reliably on PaaS hosts like Render. Employs aggressive Cache-Control bypass headers and frontend cache-busting timestamp mechanisms to fully avoid proxy/CDN `304 Not Modified` stalls.
* **🚀 Production GitOps (CI/CD):** Implements automated deployments via GitHub Actions (`deploy.yml`) that securely logs into AWS EC2 via SSH, pulls code, rebuilds Docker images, and restarts active containers.

---

## 🏗️ System Architecture

The following diagram illustrates how the system's microservices and databases interact:

```
                            ┌──────────────────────────────────┐
                            │      React SPA (Tailwind CSS)    │
                            └────────────────┬─────────────────┘
                                             │ (HTTP & Cache-Bust)
                                             ▼
                            ┌──────────────────────────────────┐
                            │    Express.js Backend Service    │
                            └────┬──────────────┬───────────┬──┘
                                 │              │           │
           (Persist & Retrieve)  │              │           │ (Structured LLM Execution)
                                 ▼              │           ▼
                       ┌───────────┐            │     ┌───────────┐
                       │  MongoDB  │            │     │ Groq LLM  │
                       │ (Atlas /  │            │     │   (API)   │
                       │  Docker)  │            │     └───────────┘
                       └───────────┘            ▼
                                        ┌───────────────┐
                                        │  RAG Engine   │
                                        └───────┬───────┘
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
               ┌──────────────────────┐                     ┌────────────────────┐
               │    Qdrant Cloud      │                     │ FastAPI Embedding  │
               │ (Semantic Vector DB) │                     │ (Python / PyTorch) │
               └──────────────────────┘                     └────────────────────┘
```

---

## 📂 Codebase Structure & Components

### 1. Python FastAPI Embedding Microservice (`/backend/src/ai/embedding-service.py`)
* **Technology:** FastAPI, PyTorch, Sentence-Transformers, Uvicorn.
* **Model:** `BAAI/bge-small-en-v1.5` (running locally).
* **Details:** Exposes a high-performance HTTP POST `/embed` endpoint. When the server starts up, it loads the model into memory. In production/cloud deployments, if the local Python microservice is not configured, the Node.js backend automatically falls back to HuggingFace Inference API endpoints using Authorization Bearer Tokens.

### 2. Node.js Express.js API Gateway (`/backend/server.js`)
* **Technology:** Express.js, Mongoose, Cors, Dotenv.
* **Mongoose Model (`/src/models/Vulnerability.js`):** Integrates directly with the pre-existing MongoDB collection (`datas`), managing fields for:
  - `server`: target hostname/container
  - `code`: CVE / internal security code
  - `issue`: textual description of the issue
  - `severity`: enum configuration (`High`, `Low`)
  - `timestamp`: date of incident detection
* **Caching Defense:** Injected response headers prevent proxy caching:
  ```javascript
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  ```

### 3. React Frontend Dashboard (`/frontend/src`)
* **Technology:** React 18, Axios, Tailwind CSS, Recharts.
* **State Management:** Employs optimized React Hooks (`useMemo`, `useEffect`) to run search queries and client-side sorting of security risks without triggering expensive database re-fetches.
* **Active Cache-Busting:** Axios triggers API requests appended with timestamp parameters (`_t: Date.now()`) combined with `no-cache` headers, ensuring the UI always reports live scanner results.

---

## 🛠️ Tech Stack & Dependencies

### Backend & AI Components
* **Server Framework:** Express.js (v5) & Mongoose (v8).
* **Vector Database:** Qdrant Cloud client (`@qdrant/js-client-rest`).
* **Embeddings Service:** PyTorch, sentence-transformers, FastAPI, Uvicorn.
* **LLM Orchestration:** Groq Cloud API.

### Frontend Dashboard
* **Compiler & Bundler:** Vite & PostCSS.
* **Styling Framework:** Tailwind CSS (v3).
* **Charting Engine:** Recharts (responsive Pie charts and cell graphs).
* **Network Client:** Axios (configured with request interceptors for headers/timeouts).

### CI/CD & Infrastructure
* **Deployment System:** GitHub Actions & Docker.
* **Hosting Platforms:** AWS EC2 (production) / Render PaaS (staging).

---

## 🚀 Installation & Deployment

### 1. Local Development (Docker-Free Setup)

#### Step A: Run Embedding Service
```bash
cd backend/src/ai/embedding-service.py
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --port 8000 --host 0.0.0.0
```

#### Step B: Start Backend API
Make sure you have a local MongoDB instance running, and configure the `.env` inside `/backend`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/fullstackapp
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-70b-8192
QDRANT_URL=https://your-qdrant-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=cve_knowledge_base_v2
EMBEDDING_API_URL=http://localhost:8000/embed
```
Run the Node.js server:
```bash
cd backend
npm install
npm run dev
```

#### Step C: Start Frontend Dashboard
Configure the `/frontend/.env` variables:
```env
VITE_API_URL=http://localhost:5000
VITE_BACKEND_URL=http://localhost:5000
```
Run Vite development server:
```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 CI/CD Pipeline (GitHub Actions to AWS EC2)

The file [deploy.yml](file:///.github/workflows/deploy.yml) provides a complete CI/CD workflow that automates the deployment cycle on every push to the `master` branch:

1. **Authentication:** Connects securely to the AWS EC2 virtual machine using SSH keys stored in GitHub Secrets.
2. **Pulling Code:** Navigates to the workspace and executes `git pull`.
3. **Docker Multi-Container Builds:**
   - Builds the production React SPA optimized by Vite: `docker build -t frontend ./frontend`
   - Builds the Express.js backend image: `docker build -t backend ./backend`
4. **Zero-Downtime Cleanups:** Gracefully stops and removes previous active containers.
5. **Launch:** Boots the frontend container bound to port `3000` and the backend container bound to port `5000` loading production environment configurations.

---

## 🧑‍💻 Portfolio Value & Resume Highlights

* **Automated DevSecOps Processes:** Showcase your ability to write secure, production-grade tools that process CVE parameters, evaluate enterprise severity, and map remediation pathways automatically.
* **Modern RAG & NLP Architectures:** Demonstrates core engineering skills in building custom vector embedding pipelines, connecting Python AI microservices with Node.js APIs, and executing similarity checks.
* **Production CI/CD & GitOps:** Exhibits strong practical experience building and deploying multi-container Docker applications to cloud providers (AWS EC2) via GitHub Actions.
* **Advanced Caching Mitigation:** Highlights troubleshooting and debugging skills, demonstrating how to bypass proxy caching limits (like Render or Cloudflare) using headers and URL timestamp parameters.
