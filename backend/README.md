# Backend

This directory contains the Flask API for UNC Financials. The backend owns the
database connection, request validation, service-layer business rules,
repository queries, market data integration, Swagger documentation, and backend
tests.

## Backend Responsibilities

- Serve REST API endpoints from `app.py`
- Validate incoming portfolio and holding payloads in `validators.py`
- Store portfolios and holding transactions in MySQL
- Calculate active positions from BUY and SELL transaction history
- Update portfolio cash balance when holdings are created
- Prevent invalid operations such as overselling shares
- Load stock prices, logos, price history, most-active stocks, and market news
- Convert database values like `Decimal` and dates into JSON-safe responses
- Raise service errors that API routes translate into HTTP responses

## Directory Guide

```text
backend/
|-- app.py                         Flask routes and Swagger docs
|-- db.py                          MySQL connection helper
|-- market_data.py                 Yahoo Finance helpers
|-- serializers.py                 JSON-safe database serialization
|-- table_initializer.py           Database/table creation script
|-- validators.py                  Request payload validation
|-- repositories/
|   |-- holding_repository.py      SQL for holding transactions and positions
|   `-- portfolio_repository.py    SQL for portfolios and balances
|-- services/
|   |-- errors.py                  Service-layer exception classes
|   |-- holding_service.py         Holding CRUD, balance updates, sell checks
|   |-- performance_service.py     Portfolio performance calculations
|   |-- portfolio_service.py       Portfolio CRUD and delete rules
|   |-- position_service.py        Active position/cost-basis calculation
|   `-- stock_service.py           Stock/news API business wrapper
`-- tests/
    |-- api/                       Flask route tests
    |-- integration/               MySQL CRUD tests
    `-- unit/                      Validator, serializer, service tests
```

## Prerequisites

- Python 3.11+
- Docker Desktop
- pip

## Local Python Setup

From `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Docker Setup

From the repository root, start the full stack:

```bash
docker compose up --build
```

This starts:

- Flask API at `http://localhost:5001`
- Swagger docs at `http://localhost:5001/apidocs/`
- MySQL 8.0 at `localhost:3306`
- `db-init`, a one-time service that runs `table_initializer.py`
- React frontend at `http://localhost:5173`

The Compose environment uses:

```text
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=devpassword
MYSQL_DATABASE=portfolio_manager
```

The API container mounts `backend/` into `/app`, so saving Python files reloads
Flask in debug mode. Rebuild only after changing `requirements.txt` or the
backend `Dockerfile`.

Useful Docker commands:

```bash
docker compose logs -f api
docker compose down
docker compose up
```

MySQL data persists in the `mysql_data` Docker volume.

## Environment Variables

`db.py` and `table_initializer.py` read these values:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MYSQL_HOST` | `localhost` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `root` | MySQL user |
| `MYSQL_PASSWORD` | `devpassword` | MySQL password |
| `MYSQL_DATABASE` | `portfolio_manager` | Database name |

The backend also calls Yahoo Finance through `yfinance`. No API key is required
for the current market data helpers.

## API Documentation

Swagger UI is available at:

```text
http://localhost:5001/apidocs/
```

All POST and PUT request bodies must be JSON. In Postman, choose **Body**,
**raw**, and **JSON**. In curl, include:

```text
Content-Type: application/json
```

## Endpoint Summary

| Method | Endpoint | Purpose | Success |
| --- | --- | --- | --- |
| `GET` | `/` | Health check | `200` |
| `GET` | `/api/stocks/most-active` | List most-active stocks | `200` |
| `GET` | `/api/stocks/<ticker>/price?currency=USD` | Get stock details and converted price | `200` |
| `GET` | `/api/stocks/news` | List market news | `200` |
| `GET` | `/api/portfolios` | List portfolios | `200` |
| `POST` | `/api/portfolios` | Create portfolio | `201` |
| `GET` | `/api/portfolios/<portfolio_id>` | Get one portfolio | `200` |
| `PUT` | `/api/portfolios/<portfolio_id>` | Update portfolio | `200` |
| `DELETE` | `/api/portfolios/<portfolio_id>` | Delete portfolio | `200` |
| `GET` | `/api/holdings?portfolio_id=<id>` | List holding transactions | `200` |
| `POST` | `/api/holdings` | Create BUY or SELL transaction | `201` |
| `GET` | `/api/holdings/<holding_id>` | Get one holding transaction | `200` |
| `PUT` | `/api/holdings/<holding_id>` | Update holding transaction | `200` |
| `DELETE` | `/api/holdings/<holding_id>` | Delete holding transaction | `200` |
| `GET` | `/api/portfolios/<portfolio_id>/positions` | List active positions | `200` |
| `GET` | `/api/portfolios/<portfolio_id>/performance` | Get one-month performance points | `200` |

## Health Check

```bash
curl http://localhost:5001/
```

Response:

```text
Welcome to UNC-Financials Portfolio Manager!
```

## Portfolio API

### Create Portfolio

```bash
curl -X POST http://localhost:5001/api/portfolios \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Retirement Portfolio",
    "base_currency": "USD",
    "balance": 10000
  }'
```

Successful response:

```json
{
  "id": 1,
  "name": "Retirement Portfolio",
  "base_currency": "USD",
  "balance": "10000.00",
  "message": "Portfolio created successfully"
}
```

Required fields:

- `name`
- `base_currency`

Optional fields:

- `balance`, defaults to `0.00`

Validation rules:

- `name` must be a non-empty string of at most 255 characters
- `base_currency` must be a three-letter uppercase currency code
- `balance` must be zero or greater

### List Portfolios

```bash
curl http://localhost:5001/api/portfolios
```

### Get Portfolio

```bash
curl http://localhost:5001/api/portfolios/1
```

Missing portfolio response:

```json
{
  "error": "Portfolio not found"
}
```

### Update Portfolio

```bash
curl -X PUT http://localhost:5001/api/portfolios/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Portfolio",
    "base_currency": "USD",
    "balance": 12000
  }'
```

### Delete Portfolio

```bash
curl -X DELETE http://localhost:5001/api/portfolios/1
```

Successful response:

```json
{
  "message": "Successfully deleted portfolio with id 1"
}
```

A portfolio cannot be deleted while it has active positions. In that case the
API returns `409 Conflict`. Once all positions are fully sold, deleting the
portfolio also deletes its holding transaction history so the foreign-key
relationship remains valid.

## Holding API

Each holding row is one transaction, not a live position. Active positions are
calculated later from all BUY and SELL rows.

### Create Holding

```bash
curl -X POST http://localhost:5001/api/holdings \
  -H "Content-Type: application/json" \
  -d '{
    "portfolio_id": 1,
    "ticker": "AAPL",
    "asset_name": "Apple Inc.",
    "asset_type": "STOCK",
    "currency": "USD",
    "trade_type": "BUY",
    "quantity": 10.5,
    "price_per_unit": 195.25,
    "fee_amount": 2.99,
    "traded_at": "2026-07-27 14:30:00"
  }'
```

Successful response:

```json
{
  "id": 1,
  "portfolio_balance": "7946.39",
  "message": "Successfully created holding with holding_id 1 & portfolio_id 1"
}
```

Required fields:

- `portfolio_id`
- `ticker`
- `asset_name`
- `asset_type`
- `currency`
- `trade_type`
- `quantity`
- `price_per_unit`
- `traded_at`

Optional fields:

- `fee_amount`, defaults to `0.00`

Validation rules:

- `portfolio_id` must be a positive integer
- `ticker` must be a non-empty string of at most 20 characters
- `asset_name` must be a non-empty string of at most 255 characters
- `asset_type` must be a non-empty string of at most 50 characters
- `currency` must be a three-letter uppercase currency code
- `trade_type` must be `BUY` or `SELL`
- `quantity` must be greater than zero
- `price_per_unit` must be zero or greater and have at most 3 decimal places
- `fee_amount` must be zero or greater
- `traded_at` must use `YYYY-MM-DD HH:MM:SS`

Balance rules:

- `BUY` subtracts `quantity * price_per_unit + fee_amount`
- `SELL` adds `quantity * price_per_unit - fee_amount`
- A `BUY` that would make the balance negative returns `400 Bad Request`
- A `SELL` for more shares than owned returns `400 Bad Request`

### List Holdings

```bash
curl "http://localhost:5001/api/holdings?portfolio_id=1"
```

### Get Holding

```bash
curl http://localhost:5001/api/holdings/1
```

Example response:

```json
{
  "id": 1,
  "portfolio_id": 1,
  "ticker": "AAPL",
  "asset_name": "Apple Inc.",
  "asset_type": "STOCK",
  "currency": "USD",
  "trade_type": "BUY",
  "quantity": "10.500000",
  "price_per_unit": "195.25",
  "fee_amount": "2.99",
  "traded_at": "Mon, 27 Jul 2026 14:30:00 GMT",
  "created_at": "Mon, 27 Jul 2026 14:30:00 GMT"
}
```

MySQL `DECIMAL` values may be returned as strings when preserving exact
database precision matters.

### Update Holding

```bash
curl -X PUT http://localhost:5001/api/holdings/1 \
  -H "Content-Type: application/json" \
  -d '{
    "portfolio_id": 1,
    "ticker": "AAPL",
    "asset_name": "Apple Inc.",
    "asset_type": "STOCK",
    "currency": "USD",
    "trade_type": "BUY",
    "quantity": 12,
    "price_per_unit": 190,
    "fee_amount": 1.50,
    "traded_at": "2026-07-27 14:30:00"
  }'
```

### Delete Holding

```bash
curl -X DELETE http://localhost:5001/api/holdings/1
```

## Positions

```bash
curl http://localhost:5001/api/portfolios/1/positions
```

Positions are built by `services/position_service.py` from transaction history:

- Transactions are grouped by `(ticker, currency)`
- BUY adds quantity and increases cost basis by purchase value plus fees
- SELL removes quantity and reduces cost basis using weighted average cost
- Fully sold positions are hidden
- Current price is used only for market value and unrealized gain

Example response:

```json
[
  {
    "ticker": "AAPL",
    "asset_name": "Apple Inc.",
    "asset_type": "STOCK",
    "currency": "USD",
    "quantity_owned": 31.5,
    "average_cost": 165.37,
    "cost_basis": 5209.1,
    "current_price": 210.25,
    "market_value": 6622.88,
    "unrealized_gain": 1413.78,
    "unrealized_gain_percent": 27.14,
    "logo_url": null
  }
]
```

If transaction history would create a negative position, the API returns
`409 Conflict`. If current market data cannot be loaded, it returns
`502 Bad Gateway`.

## Performance

```bash
curl http://localhost:5001/api/portfolios/1/performance
```

Performance uses the current active position quantities and one month of daily
closing prices from Yahoo Finance. It returns date points with total portfolio
value and per-stock values.

Important limitation: this is a current-holdings performance estimate. It does
not reconstruct historical quantities on each transaction date and does not
include cash balance.

## Stock And Market Data API

### Most Active Stocks

```bash
curl http://localhost:5001/api/stocks/most-active
```

### Stock Price

```bash
curl "http://localhost:5001/api/stocks/AAPL/price?currency=USD"
```

The `currency` query parameter defaults to `USD`. The backend validates that it
is a three-letter alphabetic code, loads the stock's source currency from Yahoo
Finance, and converts the latest price using the Yahoo Finance exchange-rate
ticker.

### Market News

```bash
curl http://localhost:5001/api/stocks/news
```

The response includes headline, publisher, published time, description, image
URL, and article URL when Yahoo Finance provides them.

## Service Layer

The route functions in `app.py` should stay thin. They parse request data, call
validators, call service functions, catch `ServiceError`, and return JSON.

Service files handle backend business behavior:

- `portfolio_service.py`: portfolio CRUD and portfolio delete safety checks
- `holding_service.py`: holding CRUD, balance updates, and oversell protection
- `position_service.py`: average-cost active position calculation
- `performance_service.py`: one-month performance chart calculations
- `stock_service.py`: market data validation and error translation
- `errors.py`: custom errors with HTTP status codes

## Validation

POST and PUT endpoints validate payloads before calling services:

- Portfolio payloads use `validate_portfolio_payload`
- Holding payloads use `validate_holding_payload`

Missing required fields return `400 Bad Request`. The backend does not use
database schema introspection for request validation; required fields are listed
explicitly in `validators.py`.

## Error Handling

Services raise errors from `services/errors.py`:

| Error | HTTP status | Meaning |
| --- | --- | --- |
| `BadRequestError` | `400` | Request data is invalid for the operation |
| `NotFoundError` | `404` | Requested portfolio or holding does not exist |
| `ConflictError` | `409` | Request conflicts with current portfolio state |
| `ExternalServiceError` | `502` | Yahoo Finance or market data call failed |
| `ServiceError` | `500` | General database or service failure |

Routes catch these errors and return:

```json
{
  "error": "message"
}
```

## Tests

Run unit and route tests from `backend/`:

```bash
pytest
pytest --cov=.
```

Run a focused test file:

```bash
pytest tests/unit/test_positions.py
```

Run MySQL integration tests after starting a test database:

```bash
RUN_DB_INTEGRATION_TESTS=1 MYSQL_DATABASE=portfolio_manager_test pytest tests/integration
```

On Windows PowerShell:

```powershell
$env:RUN_DB_INTEGRATION_TESTS="1"
$env:MYSQL_DATABASE="portfolio_manager_test"
pytest tests/integration
```

Inside the Docker API container:

```bash
docker exec portfolio_manager_api python -m pytest tests/unit
```

## Common Workflow

1. Start the app with `docker compose up --build`.
2. Open Swagger at `http://localhost:5001/apidocs/`.
3. Create a portfolio with `POST /api/portfolios`.
4. Create BUY transactions with `POST /api/holdings`.
5. View active positions with `GET /api/portfolios/<id>/positions`.
6. Create SELL transactions only for shares the portfolio owns.
7. Use tests before committing backend changes.
