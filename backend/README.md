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

Port `5001` is used on the host because macOS often reserves `5000` for AirPlay.

## Run without the API container

You can still run Flask directly on the host while keeping only MySQL in Docker:

```bash
docker compose up -d mysql
cd backend
flask --app app run --debug
```

In this mode, run `python create_portfolio_table.py` once from `backend/` to create
the table.

## Portfolio endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/portfolios` | Create a portfolio |
| `GET` | `/api/portfolios` | List portfolios |
| `GET` | `/api/portfolios/<uuid>` | Get a portfolio |
| `PATCH` | `/api/portfolios/<uuid>` | Update a portfolio |
| `DELETE` | `/api/portfolios/<uuid>` | Delete a portfolio |

Create a portfolio:

```bash
curl -X POST http://127.0.0.1:5001/api/portfolios \
  -H "Content-Type: application/json" \
  -d '{"name":"Retirement Portfolio","base_currency":"usd"}'
```

List portfolios:

```bash
curl http://127.0.0.1:5001/api/portfolios
```

Update a portfolio (replace `<uuid>` with its ID):

```bash
curl -X PATCH http://127.0.0.1:5001/api/portfolios/<uuid> \
  -H "Content-Type: application/json" \
  -d '{"name":"Long-Term Retirement"}'
```

Delete a portfolio:

```bash
curl -X DELETE http://127.0.0.1:5001/api/portfolios/<uuid>
```

Only `name` and `base_currency` can be supplied by clients. The database generates
`id`, `created_at`, and `updated_at`. See `structure_documentation/` for the planned
portfolio-manager schema and class design.
