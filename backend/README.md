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
- A one-time `db-init` service that runs `table_initializer.py` to create the
  database tables

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

## API

The API is available at:

```text
http://localhost:5001
```

Interactive Swagger API documentation is available at:

```text
http://localhost:5001/apidocs/
```


All request bodies must be JSON. In Postman, choose **Body**, **raw**, and
**JSON**. For command-line examples, the `Content-Type: application/json`
header is included in each `curl` command.

### Endpoint summary

| Method | Endpoint | Purpose | Success |
| --- | --- | --- | --- |
| `GET` | `/` | Check that the API is running | `200` |
| `GET` | `/api/portfolios` | List portfolios | `200` |
| `POST` | `/api/portfolios` | Create a portfolio | `201` |
| `GET` | `/api/portfolios/<portfolio_id>` | Get one portfolio | `200` |
| `PUT` | `/api/portfolios/<portfolio_id>` | Update a portfolio | `200` |
| `DELETE` | `/api/portfolios/<portfolio_id>` | Delete one portfolio | `200` |
| `GET` | `/api/portfolios/<portfolio_id>/positions` | List active grouped positions | `200` |
| `GET` | `/api/holdings?portfolio_id=<id>` | List portfolio holdings | `200` |
| `POST` | `/api/holdings` | Record a holding transaction | `201` |
| `GET` | `/api/holdings/<holding_id>` | Get one holding transaction | `200` |
| `PUT` | `/api/holdings/<holding_id>` | Update a holding transaction | `200` |
| `DELETE` | `/api/holdings/<holding_id>` | Delete one holding transaction | `200` |
| `GET` | `/api/stocks/<ticker>/price` | Get latest stock price | `200` |

### Check the API

```bash
curl http://localhost:5001/
```

Response:

```text
Welcome to UNC-Financials Portfolio Manager!
```

### Create a portfolio

```http
POST /api/portfolios
```

Request:

```bash
curl -X POST http://localhost:5001/api/portfolios \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Retirement Portfolio",
    "base_currency": "USD",
    "balance": 10000
  }'
```

Successful response (`201 Created`):

```json
{
  "id": 1,
  "name": "Retirement Portfolio",
  "base_currency": "USD",
  "balance": "10000.00",
  "message": "Portfolio created successfully"
}
```

Both `name` and `base_currency` are required. `balance` is optional and defaults
to `0.00`. A missing required field returns `400 Bad Request`.

### Get a portfolio

Replace `1` with the portfolio ID:

```bash
curl http://localhost:5001/api/portfolios/1
```

Successful response (`200 OK`):

```json
{
  "id": 1,
  "name": "Retirement Portfolio",
  "base_currency": "USD",
  "created_at": "Mon, 27 Jul 2026 14:30:00 GMT",
  "updated_at": "Mon, 27 Jul 2026 14:30:00 GMT"
}
```

If the ID does not exist, the API returns `404 Not Found`:

```json
{
  "error": "Portfolio not found"
}
```

### Delete a portfolio

Replace `1` with the portfolio ID:

```bash
curl -X DELETE http://localhost:5001/api/portfolios/1
```

Successful response (`200 OK`):

```json
{
  "message": "Successfully deleted portfolio with id 1"
}
```

The endpoint returns `404 Not Found` if the portfolio does not exist. A
portfolio referenced by a holding cannot be deleted until its holdings are
deleted because `HOLDING.portfolio_id` is a foreign key.

### List active positions

This endpoint groups holding transactions into one active position row per
ticker and currency. It uses weighted average cost basis and calls Yahoo Finance
through `get_current_price()` to calculate market value and unrealized gain.

```bash
curl http://localhost:5001/api/portfolios/1/positions
```

Successful response (`200 OK`):

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
    "unrealized_gain_percent": 27.14
  }
]
```

If transactions imply a negative position, such as selling more shares than the
portfolio owns, the endpoint returns `409 Conflict`. If market data cannot be
loaded, the endpoint returns `502 Bad Gateway`.

### Get a stock price

```bash
curl http://localhost:5001/api/stocks/AAPL/price
```

Successful response (`200 OK`):

```json
{
  "ticker": "AAPL",
  "current_price": 210.25
}
```

### Create a holding

Each holding row records one `BUY` or `SELL` transaction. The referenced
portfolio must already exist.

```http
POST /api/holdings
```

Request:

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

Successful response (`201 Created`):

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
- `trade_type` (`BUY` or `SELL`)
- `quantity` (greater than zero)
- `price_per_unit` (zero or greater)
- `traded_at` (`YYYY-MM-DD HH:MM:SS`)

`fee_amount` is optional and defaults to `0.00`. When supplied, it must be
zero or greater.

Creating a holding also updates the portfolio cash balance in the same database
transaction. A `BUY` subtracts `quantity * price_per_unit + fee_amount`; a
`SELL` adds `quantity * price_per_unit - fee_amount`. A `BUY` that costs more
than the available balance returns `400 Bad Request`.

The endpoint returns `400 Bad Request` for missing required fields and
`404 Not Found` when `portfolio_id` does not identify an existing portfolio.

### Get a holding

Replace `1` with the holding ID:

```bash
curl http://localhost:5001/api/holdings/1
```

Successful response (`200 OK`):

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

MySQL `DECIMAL` values may be represented as JSON strings so their precision
is preserved. A missing holding returns `404 Not Found`:

```json
{
  "error": "Holding not found"
}
```

### Delete a holding

Replace `1` with the holding ID:

```bash
curl -X DELETE http://localhost:5001/api/holdings/1
```

Successful response (`200 OK`):

```json
{
  "message": "Successfully deleted holding with id 1"
}
```

The endpoint returns `404 Not Found` if the holding does not exist.

## Suggested Postman workflow

1. Start the application with `docker compose up --build`.
2. Create a portfolio using `POST /api/portfolios`.
3. Copy the generated portfolio `id` from the response.
4. Use that portfolio ID to create a holding with `POST /api/holdings`.
5. List holdings with `GET /api/holdings?portfolio_id=1`.
6. Read, update, or delete the holding using its returned `id`.

The React client performs this workflow automatically and refreshes its state
from MySQL after every successful mutation.
