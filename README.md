# UNC Financials

UNC Financials is a React, Flask, and MySQL portfolio manager. The current
release supports complete CRUD workflows for portfolios and holding
transactions. Performance, allocation, overview, and activity screens remain
visual placeholders until market-data features are added.

## Start the application

Build and start the React frontend, Flask API, and MySQL from the repository
root:

```powershell
docker compose up --build
```

Open `http://localhost:5173`. Swagger remains available at
`http://localhost:5001/apidocs/`. On a new database, the application asks you
to create a portfolio before showing the holdings workspace.

For frontend-only development with Vite hot reload, keep Docker running and
run `npm run dev` from `frontend/`. Stop the Compose `frontend` service first
to free port `5173`.

## How the connection works

1. React calls a relative URL such as `GET /api/holdings?portfolio_id=1`.
2. During development, Vite proxies `/api` requests to Flask on port `5001`.
3. Flask validates the input and runs a parameterized MySQL query.
4. Flask serializes database decimals and dates into stable JSON values.
5. `frontend/src/api.ts` translates API `snake_case` into React `camelCase`.
6. React replaces its current state with the saved database response.

Create, update, and delete operations wait for Flask to succeed and then
reload the selected portfolio's holdings. This keeps the database as the
source of truth instead of pretending a change succeeded locally.

## CRUD endpoints

| Resource | Create | Read/list | Update | Delete |
| --- | --- | --- | --- | --- |
| Portfolios | `POST /api/portfolios` | `GET /api/portfolios`, `GET /api/portfolios/<id>` | `PUT /api/portfolios/<id>` | `DELETE /api/portfolios/<id>` |
| Holdings | `POST /api/holdings` | `GET /api/holdings?portfolio_id=<id>`, `GET /api/holdings/<id>` | `PUT /api/holdings/<id>` | `DELETE /api/holdings/<id>` |

Deleting a portfolio with holding transactions returns `409 Conflict`. Remove
its holdings first so the database foreign-key relationship stays valid.

See [backend/README.md](backend/README.md) for API payloads and
[frontend/README.md](frontend/README.md) for the frontend architecture.

## Testing and CI

Backend unit and route tests use pytest:

```powershell
cd backend
pytest
pytest --cov=.
```

Database-backed integration tests require a MySQL test database:

```powershell
cd backend
$env:RUN_DB_INTEGRATION_TESTS="1"
$env:MYSQL_DATABASE="portfolio_manager_test"
pytest tests/integration
```

The GitHub Actions workflow in `.github/workflows/ci.yml` runs backend unit,
route, and MySQL integration tests on pull requests and pushes to `main`.
