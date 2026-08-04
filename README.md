# UNC Financials

UNC Financials is a portfolio manager built with React, Flask, and MySQL. It
lets users create portfolios, record BUY and SELL transactions, view active
positions, inspect allocation and unrealized gain, chart one-month performance,
and read recent market news.

## Project Structure

```text
.
|-- backend/    Flask API, MySQL access, services, validation, tests
|-- frontend/   React/Vite client
`-- docker-compose.yml
```

The backend owns the portfolio data model, validation, business rules, market
data calls, and API responses. The frontend calls the backend API and renders
the portfolio workspace.

## Quick Start

From the repository root:

```bash
docker compose up --build
```

This starts:

- React frontend: `http://localhost:5173`
- Flask API: `http://localhost:5001`
- Swagger docs: `http://localhost:5001/apidocs/`
- MySQL database: `localhost:3306`

On a new database, create a portfolio first. After that, you can add holding
transactions and view positions/performance.

## Main Features

- Portfolio CRUD
- Holding transaction CRUD
- BUY and SELL balance updates
- Oversell protection for SELL transactions
- Active positions calculated from transaction history
- Average cost basis, market value, unrealized gain, and unrealized gain percent
- One-month portfolio performance chart data
- Stock price lookup with currency conversion
- Most-active stocks and recent market news
- Swagger API documentation
- Pytest unit, route, and integration tests

## How The App Connects

1. React calls API routes such as `GET /api/holdings?portfolio_id=1`.
2. Vite proxies `/api` requests to Flask during development.
3. Flask validates request data before calling the service layer.
4. Services apply business rules and call repositories or market data helpers.
5. Repositories run parameterized MySQL queries.
6. API responses serialize database values into JSON for the frontend.

The database is the source of truth. After create, update, or delete actions,
the frontend reloads saved data from the API instead of assuming the local
state is correct.

## Documentation

- Backend setup, routes, validation, services, tests, and database details:
  [backend/README.md](backend/README.md)
- Frontend setup and architecture:
  [frontend/README.md](frontend/README.md)

## Testing

Backend tests:

```bash
cd backend
pytest
pytest --cov=.
```

Database integration tests require a MySQL test database:

```bash
cd backend
RUN_DB_INTEGRATION_TESTS=1 MYSQL_DATABASE=portfolio_manager_test pytest tests/integration
```

On Windows PowerShell:

```powershell
cd backend
$env:RUN_DB_INTEGRATION_TESTS="1"
$env:MYSQL_DATABASE="portfolio_manager_test"
pytest tests/integration
```
