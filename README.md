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

## Enhancement Highlights

### UI and User Experience

- The React interface uses tab-style page navigation for Holdings, Allocation,
  and Performance so users can move between major workflows without scrolling
  through one long page.
- Portfolio positions refresh automatically every 30 seconds while a portfolio
  is selected, keeping current prices, market value, and unrealized gain updated
  after trades and market-data changes.
- Allocation and performance views include graphics-based charts: a native SVG
  doughnut chart for portfolio allocation and a native SVG line chart for
  one-month portfolio value. The UI also uses the `lucide-react` graphics/icon
  package for buttons, navigation, empty states, and dashboard cards.
- Tables include search, asset filtering, empty states, loading states, and
  transaction-history access to reduce unnecessary scrolling and improve daily
  portfolio review.

### Portfolio Features

- Stock lookup, current prices, logos, historical prices, most-active stocks,
  and recent stock-market news are pulled from Yahoo Finance through the
  backend `yfinance` integration.
- The Performance page includes a news feed from `GET /api/stocks/news`, which
  returns recent market articles with publisher, title, summary, image, and
  original article URL.
- Portfolio valuation supports base-currency workflows. Stock price lookup and
  holdings valuation use currency conversion so displayed prices and labels
  match the portfolio currency.

### Configuration

- Database settings are not hard coded inside application logic. The backend
  reads `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and
  `MYSQL_DATABASE` from environment variables in `backend/db.py` and
  `backend/table_initializer.py`.
- `docker-compose.yml` supplies local development defaults for those variables,
  while tests can override them, for example with
  `MYSQL_DATABASE=portfolio_manager_test`.

### Development Methodology

- Work can be tracked with GitHub Issues by creating one issue per feature,
  bug, or documentation task, then referencing the issue number in commits and
  pull requests.
- The test suite supports the development workflow with unit tests for service
  logic and validators, route tests for REST behavior, and optional MySQL
  integration tests.

### REST and API Documentation

- The Flask backend exposes REST-style JSON endpoints for portfolios, holdings,
  positions, performance, stock lookup, most-active stocks, and news.
- Swagger documentation is enabled through `flasgger` and is available locally
  at `http://localhost:5001/apidocs/` after the API container starts.

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
