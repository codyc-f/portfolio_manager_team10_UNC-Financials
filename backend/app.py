from datetime import datetime
from decimal import Decimal, InvalidOperation

from flask import Flask, jsonify, request
import mysql.connector

from db_test_connection import get_connection

app = Flask(__name__)

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
    """Return a welcome message that confirms the API is running.

    Inputs:
        None.

    Expected output:
        A plain-text welcome message with HTTP 200.
    """
    return "Welcome to UNC-Financials Portfolio Manager!"
#TODO: add an update portfolios endpoint


@app.route("/api/portfolios", methods=["POST"])
def create_portfolio():
    """Create a portfolio from the request's JSON body.

    Inputs:
        JSON body containing ``name`` and ``base_currency``.

    Expected outputs:
        HTTP 201 with a success message when the portfolio is created.
        HTTP 400 with an error message when a required field is missing.
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
    """Return the portfolio identified by the URL path parameter.

    Inputs:
        portfolio_id: ID of the portfolio to retrieve.

    Expected outputs:
        HTTP 200 with the portfolio as JSON when it exists.
        HTTP 404 with an error message when it does not exist.
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
    """Delete the portfolio identified by the URL path parameter.

    Inputs:
        portfolio_id: ID of the portfolio to delete.

    Expected outputs:
        HTTP 200 with a deletion message when the portfolio is deleted.
        HTTP 404 with an error message when it does not exist.
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
    """Create a holding transaction from the request's JSON body.

    Inputs:
        JSON body containing ``portfolio_id``, ``ticker``, ``asset_name``,
        ``asset_type``, ``currency``, ``trade_type``, ``quantity``,
        ``price_per_unit``, and ``traded_at``. ``fee_amount`` is optional
        and defaults to 0.00.

    Expected outputs:
        HTTP 201 with the new holding ID and a success message.
        HTTP 400 when the body is not JSON or a required field is missing.
        HTTP 404 when the referenced portfolio does not exist.
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
    """Return the holding identified by the URL path parameter.

    Inputs:
        holding_id: ID of the holding to retrieve.

    Expected outputs:
        HTTP 200 with the complete holding row as JSON when it exists.
        HTTP 404 with an error message when it does not exist.
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
    """Delete the holding identified by the URL path parameter.

    Inputs:
        holding_id: ID of the holding to delete.

    Expected outputs:
        HTTP 200 with a deletion message when the holding is deleted.
        HTTP 404 with an error message when it does not exist.
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
