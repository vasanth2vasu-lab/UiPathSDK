# Project Manager Dashboard

A full-stack web application that aggregates project data from multiple Excel files and Salesforce, providing a unified master tracking view with RAG (Red/Amber/Green) status visualization.

## Features

- **Multi-source data ingestion**: Excel files (auto-parsed) + Salesforce REST API (read-only)
- **RAG Status Engine**: Automatic Red/Amber/Green computation based on configurable rules
- **Executive Dashboard**: KPI cards, sortable/filterable project table, charts
- **Project Detail Panel**: Deep-dive into any project with RAG explanations
- **Fuzzy column matching**: Handles Excel files with varying column naming conventions
- **CSV Export**: Download filtered project data

## Quick Start

```bash
# 1. Install dependencies
npm run install:all

# 2. Configure environment (optional - for Salesforce)
cp .env.example .env
# Edit .env with your Salesforce credentials

# 3. Place Excel files in /data directory
node scripts/generate_sample_data.js  # Or use your own .xlsx files

# 4. Start development servers
npm run dev
```

The backend runs on `http://localhost:3001` and the frontend on `http://localhost:5173`.

## Project Structure

```
project-manager/
├── backend/          # Express API server
│   ├── server.js     # Main server entry point
│   ├── routes/       # API route handlers
│   ├── services/     # Business logic (RAG engine, Excel parser, Salesforce)
│   └── utils/        # Column mapping, date utilities
├── frontend/         # React + Tailwind dashboard
│   └── src/
│       ├── components/  # UI components
│       ├── hooks/       # Data fetching hooks
│       └── utils/       # Formatting utilities
├── data/             # Excel files directory
├── config/           # RAG rules configuration
└── scripts/          # Data generation scripts
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server health check |
| `GET /api/projects` | All projects (supports filters) |
| `GET /api/projects/:id` | Single project detail |
| `GET /api/projects/source/excel` | Excel-sourced projects only |
| `GET /api/projects/source/salesforce` | Salesforce-sourced projects only |
| `GET /api/projects/rag/:status` | Filter by RAG status |
| `GET /api/summary` | Aggregated statistics |
| `GET /api/refresh` | Re-fetch all data (rate-limited) |
| `GET /api/departments` | Unique department list |
| `GET /api/owners` | Unique owner list |

### Query Parameters for `/api/projects`

- `?rag=red|amber|green`
- `?department=Engineering`
- `?owner=John+Smith`
- `?source=excel|salesforce`
- `?priority=high|medium|low`
- `?search=keyword`
- `?sort=end_date|rag_status|completion_pct|project_name`
- `?order=asc|desc`

## RAG Status Rules

Projects are automatically classified based on configurable rules in `config/rag_rules.json`:

- **RED**: Overdue, blocked, over budget (>110%), critical deadlines
- **AMBER**: At risk, nearing deadline with low completion, budget 90-110%
- **GREEN**: On track, healthy budget, good progress relative to timeline
- **UNKNOWN**: Insufficient data to determine status

## Salesforce Integration

The dashboard connects to Salesforce using the Username-Password OAuth flow. All interactions are **read-only** (GET requests only). Configure credentials in `.env`:

```env
SF_LOGIN_URL=https://login.salesforce.com
SF_USERNAME=your_username
SF_PASSWORD=your_password
SF_SECURITY_TOKEN=your_security_token
```

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React 18, Tailwind CSS, Recharts
- **Data**: xlsx (SheetJS), Axios
- **Build**: Vite
