from flasgger import Swagger
from flask import Flask, jsonify, request

from services.errors import ServiceError
from services import holding_service, portfolio_service, stock_service
from validators import validate_holding_payload, validate_portfolio_payload

app = Flask(__name__)

swagger = Swagger(
    app,
    template={
        "swagger": "2.0",
        "info": {
            "title": "UNC-Financials Portfolio Manager API",
            "description": (
                "REST API for creating, retrieving, and deleting portfolios "
                "and holding transactions."
            ),
            "version": "1.0.0",
        },
        "host": "localhost:5001",
        "basePath": "/",
        "schemes": ["http"],
        "consumes": ["application/json"],
        "produces": ["application/json"],
        "tags": [
            {"name": "Health", "description": "API availability"},
            {"name": "Portfolios", "description": "Portfolio operations"},
            {"name": "Holdings", "description": "Holding transaction operations"},
        ],
    },
)

@app.route("/")
def hello():
    """Check that the API is running.
    ---
    tags:
      - Health
    produces:
      - text/plain
    responses:
      200:
        description: The API is running.
        schema:
          type: string
        examples:
          text/plain: Welcome to UNC-Financials Portfolio Manager!
    """
    return "Welcome to UNC-Financials Portfolio Manager!"


@app.route("/api/stocks/most-active", methods=["GET"])
def list_most_active_stocks():
    """List the 20 most actively traded US stocks.
    ---
    tags:
      - Market Data
    responses:
      200:
        description: Most actively traded US stocks from Yahoo Finance.
        schema:
          type: array
          items:
            type: object
            properties:
              ticker:
                type: string
                example: AAPL
              name:
                type: string
                example: Apple Inc.
              currentPrice:
                type: number
                example: 195.25
      502:
        description: Market data provider could not be reached.
    """
    try:
        stocks = stock_service.list_most_active_stocks()
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(stocks), 200


@app.route("/api/stocks/<ticker>/price", methods=["GET"])
def get_stock_price(ticker):
    """Get the latest available market price for a stock ticker.
    ---
    tags:
      - Market Data
    parameters:
      - name: ticker
        in: path
        description: Stock ticker symbol.
        required: true
        type: string
        minLength: 1
        maxLength: 20
    responses:
      200:
        description: Latest available market price.
      400:
        description: The ticker is invalid.
      502:
        description: Market data provider could not be reached.
    """
    try:
        price = stock_service.get_stock_price(ticker)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(price), 200


@app.route("/api/portfolios", methods=["GET"])
def list_portfolios():
    """List all portfolios.
    ---
    tags:
      - Portfolios
    responses:
      200:
        description: Portfolios ordered by creation date.
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
                example: 1
              name:
                type: string
                example: Retirement Portfolio
              base_currency:
                type: string
                example: USD
              created_at:
                type: string
                example: '2026-07-27 14:30:00'
              updated_at:
                type: string
                example: '2026-07-27 14:30:00'
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    try:
        portfolios = portfolio_service.list_portfolios()
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(portfolios), 200


@app.route("/api/portfolios", methods=["POST"])
def create_portfolio():
    """Create a portfolio.
    ---
    tags:
      - Portfolios
    parameters:
      - in: body
        name: portfolio
        description: The portfolio to create.
        required: true
        schema:
          type: object
          required:
            - name
            - base_currency
          properties:
            name:
              type: string
              minLength: 1
              maxLength: 255
              example: Retirement Portfolio
            base_currency:
              type: string
              minLength: 3
              maxLength: 3
              pattern: '^[A-Z]{3}$'
              example: USD
    responses:
      201:
        description: Portfolio created successfully.
        schema:
          type: object
          required:
            - message
          properties:
            message:
              type: string
              example: Portfolio created successfully
      400:
        description: The JSON body or one of its fields is invalid.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Request body must be a JSON object
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    data = request.get_json(silent=True)

    validation_error = validate_portfolio_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    try:
        portfolio = portfolio_service.create_portfolio(data)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(portfolio), 201

@app.route("/api/portfolios/<portfolio_id>", methods=["GET"])
def get_portfolio(portfolio_id):
    """Get a portfolio by ID.
    ---
    tags:
      - Portfolios
    parameters:
      - name: portfolio_id
        in: path
        description: ID of the portfolio to retrieve.
        required: true
        type: integer
        minimum: 1
    responses:
      200:
        description: The requested portfolio.
        schema:
          type: object
          properties:
            id:
              type: integer
              example: 1
            name:
              type: string
              example: Retirement Portfolio
            base_currency:
              type: string
              example: USD
            created_at:
              type: string
              format: date-time
              example: Mon, 27 Jul 2026 14:30:00 GMT
            updated_at:
              type: string
              format: date-time
              example: Mon, 27 Jul 2026 14:30:00 GMT
      404:
        description: The portfolio does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Portfolio not found
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    try:
        portfolio = portfolio_service.get_portfolio(portfolio_id)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(portfolio), 200


@app.route("/api/portfolios/<portfolio_id>", methods=["PUT"])
def update_portfolio(portfolio_id):
    """Update a portfolio.
    ---
    tags:
      - Portfolios
    parameters:
      - name: portfolio_id
        in: path
        description: ID of the portfolio to update.
        required: true
        type: integer
        minimum: 1
      - in: body
        name: portfolio
        description: Replacement portfolio values.
        required: true
        schema:
          type: object
          required:
            - name
            - base_currency
          properties:
            name:
              type: string
              minLength: 1
              maxLength: 255
              example: Updated Retirement Portfolio
            base_currency:
              type: string
              minLength: 3
              maxLength: 3
              pattern: '^[A-Z]{3}$'
              example: USD
    responses:
      200:
        description: Portfolio updated successfully.
        schema:
          type: object
          properties:
            id:
              type: integer
              example: 1
            name:
              type: string
              example: Updated Retirement Portfolio
            base_currency:
              type: string
              example: USD
            message:
              type: string
              example: Portfolio updated successfully
      400:
        description: The JSON body or one of its fields is invalid.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Missing required fields
      404:
        description: The portfolio does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Portfolio not found
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    data = request.get_json(silent=True)
    validation_error = validate_portfolio_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    try:
        portfolio = portfolio_service.update_portfolio(portfolio_id, data)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(portfolio), 200


@app.route("/api/portfolios/<portfolio_id>", methods=["DELETE"])
def delete_portfolio(portfolio_id):
    """Delete a portfolio by ID.
    ---
    tags:
      - Portfolios
    description: A portfolio referenced by a holding cannot be deleted until its holdings are deleted.
    parameters:
      - name: portfolio_id
        in: path
        description: ID of the portfolio to delete.
        required: true
        type: integer
        minimum: 1
    responses:
      200:
        description: Portfolio deleted successfully.
        schema:
          type: object
          properties:
            message:
              type: string
              example: Successfully deleted portfolio with id 1
      404:
        description: The portfolio does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Portfolio not found
      500:
        description: A database operation failed, including a foreign-key constraint failure.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    try:
        result = portfolio_service.delete_portfolio(portfolio_id)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(result), 200


@app.route("/api/holdings", methods=["GET"])
def list_holdings():
    """List holdings for a portfolio.
    ---
    tags:
      - Holdings
    parameters:
      - name: portfolio_id
        in: query
        description: ID of the portfolio whose holdings should be returned.
        required: true
        type: integer
        minimum: 1
    responses:
      200:
        description: Holding transactions ordered by trade date, newest first.
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
                example: 1
              portfolio_id:
                type: integer
                example: 1
              ticker:
                type: string
                example: AAPL
              asset_name:
                type: string
                example: Apple Inc.
              asset_type:
                type: string
                example: STOCK
              currency:
                type: string
                example: USD
              trade_type:
                type: string
                enum:
                  - BUY
                  - SELL
                example: BUY
              quantity:
                type: string
                example: '10.500000'
              price_per_unit:
                type: string
                example: '195.25'
              fee_amount:
                type: string
                example: '2.99'
              traded_at:
                type: string
                example: '2026-07-27 14:30:00'
              created_at:
                type: string
                example: '2026-07-27 14:30:00'
      400:
        description: The portfolio_id query parameter is missing or invalid.
        schema:
          type: object
          properties:
            error:
              type: string
              example: "'portfolio_id' query parameter must be a positive integer"
      404:
        description: The portfolio does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Portfolio not found
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    portfolio_id = request.args.get("portfolio_id", type=int)
    if portfolio_id is None or portfolio_id <= 0:
        return jsonify({
            "error": "'portfolio_id' query parameter must be a positive integer"
        }), 400

    try:
        holdings = holding_service.list_holdings(portfolio_id)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(holdings), 200


@app.route("/api/portfolios/<portfolio_id>/positions", methods=["GET"])
def list_portfolio_positions(portfolio_id):
    """List active grouped positions for a portfolio.
    ---
    tags:
      - Portfolios
    parameters:
      - name: portfolio_id
        in: path
        description: ID of the portfolio whose active positions should be returned.
        required: true
        type: integer
        minimum: 1
    responses:
      200:
        description: Active positions grouped by ticker and currency.
      400:
        description: The portfolio_id path parameter is invalid.
      404:
        description: The portfolio does not exist.
      409:
        description: Holding transactions imply a negative position.
      500:
        description: A database operation failed.
    """
    try:
        portfolio_id = int(portfolio_id)
    except (TypeError, ValueError):
        return jsonify({"error": "'portfolio_id' must be a positive integer"}), 400

    if portfolio_id <= 0:
        return jsonify({"error": "'portfolio_id' must be a positive integer"}), 400

    try:
        positions = holding_service.list_positions(portfolio_id)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(positions), 200


@app.route("/api/holdings", methods=["POST"])
def create_holding():
    """Create a holding transaction.
    ---
    tags:
      - Holdings
    description: Records one BUY or SELL transaction for an existing portfolio.
    parameters:
      - in: body
        name: holding
        description: The holding transaction to record. fee_amount is optional and defaults to 0.00.
        required: true
        schema:
          type: object
          required:
            - portfolio_id
            - ticker
            - asset_name
            - asset_type
            - currency
            - trade_type
            - quantity
            - price_per_unit
            - traded_at
          properties:
            portfolio_id:
              type: integer
              minimum: 1
              example: 1
            ticker:
              type: string
              minLength: 1
              maxLength: 20
              example: AAPL
            asset_name:
              type: string
              minLength: 1
              maxLength: 255
              example: Apple Inc.
            asset_type:
              type: string
              minLength: 1
              maxLength: 50
              example: STOCK
            currency:
              type: string
              minLength: 3
              maxLength: 3
              pattern: '^[A-Z]{3}$'
              example: USD
            trade_type:
              type: string
              enum:
                - BUY
                - SELL
              example: BUY
            quantity:
              type: number
              format: decimal
              minimum: 0.000001
              example: 10.5
            price_per_unit:
              type: number
              format: decimal
              minimum: 0
              example: 195.25
            fee_amount:
              type: number
              format: decimal
              minimum: 0
              default: 0
              example: 2.99
            traded_at:
              type: string
              description: MySQL datetime in YYYY-MM-DD HH:MM:SS format.
              pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$'
              example: '2026-07-27 14:30:00'
    responses:
      201:
        description: Holding transaction created successfully.
        schema:
          type: object
          properties:
            id:
              type: integer
              example: 1
            message:
              type: string
              example: Successfully created holding with holding_id 1 & portfolio_id 1
      400:
        description: The JSON body or one of its fields is invalid.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Missing required fields
      404:
        description: The referenced portfolio does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Portfolio not found
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    data = request.get_json(silent=True)
    validation_error = validate_holding_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    try:
        holding = holding_service.create_holding(data)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(holding), 201


@app.route("/api/holdings/<holding_id>", methods=["GET"])
def get_holding(holding_id):
    """Get a holding transaction by ID.
    ---
    tags:
      - Holdings
    parameters:
      - name: holding_id
        in: path
        description: ID of the holding transaction to retrieve.
        required: true
        type: integer
        minimum: 1
    responses:
      200:
        description: The requested holding transaction. Decimal values may be serialized as strings to preserve precision.
        schema:
          type: object
          properties:
            id:
              type: integer
              example: 1
            portfolio_id:
              type: integer
              example: 1
            ticker:
              type: string
              example: AAPL
            asset_name:
              type: string
              example: Apple Inc.
            asset_type:
              type: string
              example: STOCK
            currency:
              type: string
              example: USD
            trade_type:
              type: string
              enum:
                - BUY
                - SELL
            quantity:
              type: string
              example: '10.500000'
            price_per_unit:
              type: string
              example: '195.25'
            fee_amount:
              type: string
              example: '2.99'
            traded_at:
              type: string
              format: date-time
              example: Mon, 27 Jul 2026 14:30:00 GMT
            created_at:
              type: string
              format: date-time
              example: Mon, 27 Jul 2026 14:30:00 GMT
      404:
        description: The holding transaction does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Holding not found
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    try:
        holding = holding_service.get_holding(holding_id)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(holding), 200


@app.route("/api/holdings/<holding_id>", methods=["PUT"])
def update_holding(holding_id):
    """Update a holding transaction.
    ---
    tags:
      - Holdings
    parameters:
      - name: holding_id
        in: path
        description: ID of the holding transaction to update.
        required: true
        type: integer
        minimum: 1
      - in: body
        name: holding
        description: Complete replacement values for the holding transaction.
        required: true
        schema:
          type: object
          required:
            - portfolio_id
            - ticker
            - asset_name
            - asset_type
            - currency
            - trade_type
            - quantity
            - price_per_unit
            - traded_at
          properties:
            portfolio_id:
              type: integer
              minimum: 1
              example: 1
            ticker:
              type: string
              minLength: 1
              maxLength: 20
              example: AAPL
            asset_name:
              type: string
              minLength: 1
              maxLength: 255
              example: Apple Inc.
            asset_type:
              type: string
              minLength: 1
              maxLength: 50
              example: STOCK
            currency:
              type: string
              minLength: 3
              maxLength: 3
              pattern: '^[A-Z]{3}$'
              example: USD
            trade_type:
              type: string
              enum:
                - BUY
                - SELL
              example: BUY
            quantity:
              type: number
              format: decimal
              minimum: 0.000001
              example: 10.5
            price_per_unit:
              type: number
              format: decimal
              minimum: 0
              example: 195.25
            fee_amount:
              type: number
              format: decimal
              minimum: 0
              default: 0
              example: 2.99
            traded_at:
              type: string
              description: MySQL datetime in YYYY-MM-DD HH:MM:SS format.
              pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$'
              example: '2026-07-27 14:30:00'
    responses:
      200:
        description: Holding transaction updated successfully.
        schema:
          type: object
          properties:
            id:
              type: integer
              example: 1
            message:
              type: string
              example: Holding updated successfully
      400:
        description: The JSON body or one of its fields is invalid.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Missing required fields
      404:
        description: The holding or referenced portfolio does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Holding not found
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    data = request.get_json(silent=True)
    validation_error = validate_holding_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    try:
        holding = holding_service.update_holding(holding_id, data)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(holding), 200


@app.route("/api/holdings/<holding_id>", methods=["DELETE"])
def delete_holding(holding_id):
    """Delete a holding transaction by ID.
    ---
    tags:
      - Holdings
    parameters:
      - name: holding_id
        in: path
        description: ID of the holding transaction to delete.
        required: true
        type: integer
        minimum: 1
    responses:
      200:
        description: Holding transaction deleted successfully.
        schema:
          type: object
          properties:
            message:
              type: string
              example: Successfully deleted holding with id 1
      404:
        description: The holding transaction does not exist.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Holding not found
      500:
        description: A database operation failed.
        schema:
          type: object
          properties:
            error:
              type: string
              example: Database error
    """
    try:
        result = holding_service.delete_holding(holding_id)
    except ServiceError as error:
        return jsonify({"error": error.message}), error.status_code

    return jsonify(result), 200



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
