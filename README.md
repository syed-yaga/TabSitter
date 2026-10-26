# TabSitter (The Browser Tab Sloth)

> **"Slow & Steady Memory for Your Browser"**  
> A hybrid local-cloud AI Chrome Extension that solves tab overload by extracting user intent, creating 768-dimensional semantic embeddings locally via Ollama, and orchestrating agentic page monitoring with Temporal & Browserbase Stagehand.

---

<div align="center">

[![Hacktoberfest 2026](https://img.shields.io/badge/Hacktoberfest_2026-Slow_and_Steady-FF7844?style=for-the-badge&logo=hacktoberfest&logoColor=white)](#)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](#)

<br/>

### Featured Categories

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](#)
[![Open Weights: Gemma](https://img.shields.io/badge/Open_Weights-Gemma-4285F4?style=for-the-badge&logo=google&logoColor=white)](#)
[![Render API](https://img.shields.io/badge/Render-Cloud_API-46E3B7?style=for-the-badge&logo=render&logoColor=black)](#)
[![Local AI](https://img.shields.io/badge/Local_AI-Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)](#)

<br/>

### Partner Categories

[![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-Vector_Search-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](#)
[![Temporal](https://img.shields.io/badge/Temporal-Temporal_Cloud-000000?style=for-the-badge&logo=temporal&logoColor=white)](#)
[![Browserbase](https://img.shields.io/badge/Browserbase-Headless_Browser-FF4F00?style=for-the-badge&logo=googlechrome&logoColor=white)](#)

</div>

---

## System Architecture & Separation of Concerns

```
                  ┌────────────────────────────────────────┐
                  │    Chrome Extension (Manifest V3)      │
                  │   React + Vite + Tailwind + Readability│
                  └───────────────┬────────────────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          │ (Direct Local Inference)                      │ (Data & Vector Ingestion)
          ▼                                               ▼
┌──────────────────────────────┐              ┌─────────────────────────────┐
│  Local Ollama (Port 11434)   │              │   Cloud API (Express + TS)  │
│  - gemma2 (Intent & Summary) │              │   - Zero LLM dependencies   │
│  - nomic-embed-text (768-dim)│              │   - Hosted on Render / Local│
└──────────────┬───────────────┘              └──────────────┬──────────────┘
               ▲                                             │
               │ (Semantic Evaluation)                       │ (aggregateRaw $vectorSearch)
               │                                             ▼
┌──────────────┴───────────────┐              ┌─────────────────────────────┐
│ Temporal Worker + Stagehand  │              │    MongoDB Atlas Cluster    │
│  - Headless Page Extraction  │              │    - SavedPage & Project    │
│  - Scheduled Watch Workflow  │              │    - Atlas Vector Search    │
└──────────────────────────────┘              └─────────────────────────────┘
```

1. **Local AI Engine (Client & Worker):** All text generation, intent extraction, and semantic diffing use `gemma2`. All vector embeddings (768 dimensions) use `nomic-embed-text`. **Zero inference happens in the cloud.**
2. **Cloud API (`/api`):** Thin Node.js/Express router backed by Prisma and MongoDB Atlas. Executes MongoDB `$vectorSearch` via `prisma.savedPage.aggregateRaw()`.
3. **Agentic Monitoring (`/worker`):** Temporal Worker leveraging Browserbase Stagehand for headless scraping and local Ollama for semantic comparison.

---

## Repository Structure

```text
TabSitter/
├── api/          # Express + TypeScript + Prisma ORM + MongoDB Vector Search
├── extension/    # React + Vite + Tailwind CSS Manifest V3 Chrome Extension
├── worker/       # Temporal Worker + Browserbase Stagehand + Ollama Evaluation
└── prd.md        # Product Requirements Document
```

---

## Quick Start Guide

### Prerequisites

1. **Node.js** (v18+ or v24+)
2. **Ollama** installed and running:
   ```bash
   ollama pull gemma2
   ollama pull nomic-embed-text
   ollama serve
   ```
   _(Note: Ollama CORS should permit Chrome Extensions: `OLLAMA_ORIGINS="chrome-extension://_"`)\*

---

### 1. Database & Cloud API (`/api`)

1. Navigate to `/api`:
   ```bash
   cd api
   ```
2. Configure `.env`:
   ```env
   PORT=3000
   DATABASE_URL="mongodb+srv://<user>:<password>@cluster0.mongodb.net/tabsitter?retryWrites=true&w=majority"
   ```
3. Generate Prisma client & build:
   ```bash
   npm run prisma:generate
   npm run build
   ```
4. Start the API server:
   ```bash
   npm run dev
   # Server runs at http://localhost:3000
   # Health check: http://localhost:3000/api/health
   ```

#### REST Endpoints

- `POST /api/pages`: Ingests tab bundles with 768-dim embeddings.
- `GET /api/projects`: Retrieves project clusters and related pages.
- `POST /api/search`: Executes MongoDB `$vectorSearch` pipeline on the `embedding` field using cosine similarity via `prisma.savedPage.aggregateRaw()`.
- `PUT /api/pages/:id/status`: Updates page status (e.g. `"reawakened"`).
- `POST /api/watches`: Registers a new `PageWatch`.

---

### 2. Chrome Extension (`/extension`)

1. Navigate to `/extension`:
   ```bash
   cd extension
   ```
2. Build the extension bundle:
   ```bash
   npm run build
   ```
   _Compiled production build will be generated in `extension/dist`._
3. Load into Google Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (top-right toggle)
   - Click **Load unpacked**
   - Select the `TabSitter/extension/dist` directory!

#### Key Features & Safety Mechanisms

- **Hammock Mode:** Scans current window tabs, sanitizes DOM with `@mozilla/readability`, prompts local Gemma 2 for `{ summary, intent, suggestedProject }`, produces 768-dim embeddings with Nomic, and saves to the Cloud API.
- **Strict Tab Safety Constraint:** `chrome.tabs.remove(tabIds)` is executed **ONLY** if the Cloud API responds with `200 OK`. If the API fails or is offline, all tabs are preserved.
- **Lazy Recall:** Vectorizes vague user queries on-the-fly and runs cosine vector search against sleeping tabs.
- **Canopy Clusters:** Displays sleeping tabs organized by automatically created project clusters.
- **Offline Detection:** If Ollama is offline, displays a user-friendly banner: _"Local AI engine is offline. Please start Ollama."_

---

### 3. Agentic Reawakening Worker (`/worker`)

1. Navigate to `/worker`:
   ```bash
   cd worker
   ```
2. Build the worker code:
   ```bash
   npm run build
   ```
3. Standalone Activity Verification:
   ```bash
   npm run test:evaluate
   ```
   _Runs `extractAndEvaluatePage` using headless Chromium, extracts content, and evaluates semantic changes via local Ollama._
4. Start the Temporal Worker:
   ```bash
   # Ensure Temporal server is running: temporal server start-dev
   npm start
   ```
5. Trigger or Schedule a Page Watch Workflow:
   ```bash
   npm run workflow:start "https://example.com"
   ```

---

## Hackathon Guardrails Checklist

- [x] **No Cloud Inference:** Zero external LLM SDKs in `/api`.
- [x] **768-Dimension Vectors:** Formatted for `nomic-embed-text`.
- [x] **MongoDB Vector Search:** Utilizes `prisma.savedPage.aggregateRaw()` with `$vectorSearch`.
- [x] **Lightweight Sanitization:** Implemented with `@mozilla/readability`.
- [x] **Strict Safety Constraint:** Tab removal gated by HTTP 200 response from API.

---

## License

MIT License. Built for Hacktoberfest 2026.
