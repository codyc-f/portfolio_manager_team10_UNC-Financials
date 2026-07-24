# Backend

## Prerequisites

- Python 3.11+ and pip
- Docker Desktop (see [Database](#database) below)

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, activate the virtual environment with:

```powershell
.venv\Scripts\Activate.ps1
```

## Database

From the **repo root** (not `backend/`), start the Flask API and MySQL:

```bash
docker compose up --build
```

This starts:

- Flask from `backend/app.py` at `http://127.0.0.1:5001`
- MySQL 8.0 at `localhost:3306`
- A one-time `db-init` service that creates the `PORTFOLIO` table

The `backend/` directory is mounted into the API container and Flask debug reload is
enabled. Saving a Python file reloads the app without rebuilding or restarting the
container. Rebuild only after changing `requirements.txt` or `Dockerfile`:

```bash
docker compose up --build
```

To stop and restart the stack:

```bash
docker compose down
docker compose up
```

MySQL data remains in the `mysql_data` volume. To follow API logs:

```bash
docker compose logs -f api
```
