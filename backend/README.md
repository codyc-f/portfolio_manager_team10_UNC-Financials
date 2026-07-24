# Backend

## Prerequisites

- Python 3.11+ and pip
- Docker Desktop (see [Database](#database) below)

## Setup

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Database

From the **repo root** (not `backend/`), start MySQL via Docker Compose:

```
docker compose up -d
```

This starts a MySQL 8.0 container (`localhost:3306`, user `root`, password `devpassword`, database `portfolio_manager`).

Then, from `backend/`, create the `PORTFOLIO` table:

```
python create_portfolio_table.py
```

## Status

No Flask application/API endpoints exist yet — only the database setup above. See `db_struc.txt` and `Class Diagram & Endpoints.txt` for the planned schema and API design.
