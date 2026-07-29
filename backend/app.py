from datetime import datetime
from decimal import Decimal, InvalidOperation

from flasgger import Swagger
from flask import Flask, jsonify, request
import mysql.connector

from db_test_connection import get_connection
from helper_functions import get_current_price
from helper_functions import get_top_20_stocks

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

HOLDING_REQUIRED_FIELDS = {
    "portfolio_id",
    "ticker",
    "asset_name",
    "asset_type",
    "currency",
    "trade_type",
    "quantity",
    "price_per_unit",
    "traded_at",
}


def is_non_empty_string(value, max_length):
    return (
        isinstance(value, str)
        and bool(value.strip())
        and len(value) <= max_length
    )


def is_currency_code(value):
    return (
        isinstance(value, str)
        and len(value) == 3
        and value.isalpha()
        and value.isupper()
    )


def is_number_in_range(value, minimum, maximum=None):
    if isinstance(value, bool):
        return False

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return False

    if not number.is_finite() or number < Decimal(str(minimum)):
        return False

    return maximum is None or number <= Decimal(str(maximum))


def is_mysql_datetime(value):
    if not isinstance(value, str):
        return False

    try:
        datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return False

    return True


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
#TODO: add an update portfolios endpoint


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

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    if "name" not in data or "base_currency" not in data:
        return jsonify({"error": "Missing required fields: 'name' and 'base_currency'"}), 400

    name = data["name"]
    base_currency = data["base_currency"]

    if not is_non_empty_string(name, 255):
        return jsonify({
            "error": "'name' must be a non-empty string of at most 255 characters"
        }), 400

    if not is_currency_code(base_currency):
        return jsonify({
            "error": "'base_currency' must be a 3-letter uppercase currency code"
        }), 400

    # 3. Use parameter placeholders (%s) to safely insert data
    sql = "INSERT INTO PORTFOLIO (name, base_currency) VALUES (%s, %s)"

    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(sql, (name, base_currency))
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    # 6. Return a success response[cite: 1]
    return jsonify({"message": "Portfolio created successfully"}), 201

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
    # Use the %s placeholder for the WHERE clause to prevent SQL injection
    sql = "SELECT id, name, base_currency, created_at, updated_at FROM PORTFOLIO WHERE id = %s"

    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    cursor.execute(sql, (portfolio_id,))
                    portfolio = cursor.fetchone()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    # If a record was found, return it. Otherwise, return a 404 error.
    if portfolio:
        return jsonify(portfolio), 200
    else:
        return jsonify({"error": "Portfolio not found"}), 404


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
    # Use a parameterized query so the portfolio ID is never treated as SQL.
    sql = "DELETE FROM PORTFOLIO WHERE id = %s"
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(sql, (portfolio_id,))
                    deleted = cursor.rowcount > 0
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    if not deleted:
        return jsonify({"error": "Portfolio not found"}), 404

    return jsonify({
        "message": f"Successfully deleted portfolio with id {portfolio_id}"
    }), 200


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

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    data_keys_set = set(data.keys())

    missing_fields = HOLDING_REQUIRED_FIELDS - data_keys_set

    if missing_fields:
        return jsonify({
            "error": f"Missing required fields: {', '.join(sorted(missing_fields))}"
        }), 400

    if (
        isinstance(data["portfolio_id"], bool)
        or not isinstance(data["portfolio_id"], int)
        or data["portfolio_id"] <= 0
    ):
        return jsonify({
            "error": "'portfolio_id' must be a positive integer"
        }), 400

    text_field_limits = {
        "ticker": 20,
        "asset_name": 255,
        "asset_type": 50,
    }
    for field, max_length in text_field_limits.items():
        if not is_non_empty_string(data[field], max_length):
            return jsonify({
                "error": (
                    f"'{field}' must be a non-empty string "
                    f"of at most {max_length} characters"
                )
            }), 400

    if not is_currency_code(data["currency"]):
        return jsonify({
            "error": "'currency' must be a 3-letter uppercase currency code"
        }), 400

    if data["trade_type"] not in {"BUY", "SELL"}:
        return jsonify({
            "error": "'trade_type' must be either 'BUY' or 'SELL'"
        }), 400

    if not is_number_in_range(data["quantity"], 0.000001):
        return jsonify({
            "error": "'quantity' must be a number greater than zero"
        }), 400

    if not is_number_in_range(data["price_per_unit"], 0):
        return jsonify({
            "error": "'price_per_unit' must be a non-negative number"
        }), 400

    if not is_number_in_range(data.get("fee_amount", 0), 0):
        return jsonify({
            "error": "'fee_amount' must be a non-negative number"
        }), 400

    if not is_mysql_datetime(data["traded_at"]):
        return jsonify({
            "error": "'traded_at' must use YYYY-MM-DD HH:MM:SS format"
        }), 400

    sql = """
        INSERT INTO HOLDING (
            portfolio_id,
            ticker,
            asset_name,
            asset_type,
            currency,
            trade_type,
            quantity,
            price_per_unit,
            fee_amount,
            traded_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    values = (
        data["portfolio_id"],
        data["ticker"],
        data["asset_name"],
        data["asset_type"],
        data["currency"],
        data["trade_type"],
        data["quantity"],
        data["price_per_unit"],
        data.get("fee_amount", 0.00),
        data["traded_at"],
    )

    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    # Give a clear response instead of relying on a foreign-key error.
                    cursor.execute(
                        "SELECT id FROM PORTFOLIO WHERE id = %s",
                        (data["portfolio_id"],),
                    )
                    if cursor.fetchone() is None:
                        return jsonify({"error": "Portfolio not found"}), 404

                    cursor.execute(sql, values)
                    holding_id = cursor.lastrowid
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "id": holding_id,
        "message": f"Successfully created holding with holding_id {holding_id} & portfolio_id {data['portfolio_id']}",
    }), 201


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
    sql = """
        SELECT
            id,
            portfolio_id,
            ticker,
            asset_name,
            asset_type,
            currency,
            trade_type,
            quantity,
            price_per_unit,
            fee_amount,
            traded_at,
            created_at
        FROM HOLDING
        WHERE id = %s
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    cursor.execute(sql, (holding_id,))
                    holding = cursor.fetchone()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    if holding is None:
        return jsonify({"error": "Holding not found"}), 404

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
    sql = "DELETE FROM HOLDING WHERE id = %s"
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(sql, (holding_id,))
                    deleted = cursor.rowcount > 0
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    if not deleted:
        return jsonify({"error": "Holding not found"}), 404

    return jsonify({
        "message": f"Successfully deleted holding with id {holding_id}"
    }), 200



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
