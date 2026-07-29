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


def validate_holding_payload(data):
    """Return a validation error string, or ``None`` for a valid holding."""
    if not isinstance(data, dict):
        return "Request body must be a JSON object"

    missing_fields = HOLDING_REQUIRED_FIELDS - set(data.keys())
    if missing_fields:
        return f"Missing required fields: {', '.join(sorted(missing_fields))}"

    if (
        isinstance(data["portfolio_id"], bool)
        or not isinstance(data["portfolio_id"], int)
        or data["portfolio_id"] <= 0
    ):
        return "'portfolio_id' must be a positive integer"

    text_field_limits = {
        "ticker": 20,
        "asset_name": 255,
        "asset_type": 50,
    }
    for field, max_length in text_field_limits.items():
        if not is_non_empty_string(data[field], max_length):
            return (
                f"'{field}' must be a non-empty string "
                f"of at most {max_length} characters"
            )

    if not is_currency_code(data["currency"]):
        return "'currency' must be a 3-letter uppercase currency code"

    if data["trade_type"] not in {"BUY", "SELL"}:
        return "'trade_type' must be either 'BUY' or 'SELL'"

    if not is_number_in_range(data["quantity"], 0.000001):
        return "'quantity' must be a number greater than zero"

    if not is_number_in_range(data["price_per_unit"], 0):
        return "'price_per_unit' must be a non-negative number"

    if not is_number_in_range(data.get("fee_amount", 0), 0):
        return "'fee_amount' must be a non-negative number"

    if not is_mysql_datetime(data["traded_at"]):
        return "'traded_at' must use YYYY-MM-DD HH:MM:SS format"

    return None


def validate_portfolio_payload(data):
    """Return a validation error string, or ``None`` for a valid portfolio."""
    if not isinstance(data, dict):
        return "Request body must be a JSON object"

    if "name" not in data or "base_currency" not in data:
        return "Missing required fields: 'name' and 'base_currency'"

    if not is_non_empty_string(data["name"], 255):
        return "'name' must be a non-empty string of at most 255 characters"

    if not is_currency_code(data["base_currency"]):
        return "'base_currency' must be a 3-letter uppercase currency code"

    return None


def serialize_db_row(row):
    """Convert database-specific values into stable JSON-friendly strings."""
    if row is None:
        return None

    serialized = {}
    for key, value in row.items():
        if isinstance(value, datetime):
            serialized[key] = value.strftime("%Y-%m-%d %H:%M:%S")
        elif isinstance(value, Decimal):
            serialized[key] = str(value)
        else:
            serialized[key] = value
    return serialized


@app.route("/")
def hello():
    """Return a welcome message that confirms the API is running.

    Inputs:
        None.

    Expected output:
        A plain-text welcome message with HTTP 200.
    """
    return "Welcome to UNC-Financials Portfolio Manager!"

@app.route("/api/portfolios", methods=["GET"])
def list_portfolios():
    """Return every portfolio, ordered by creation date."""
    sql = """
        SELECT id, name, base_currency, created_at, updated_at
        FROM PORTFOLIO
        ORDER BY created_at ASC, id ASC
    """
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                cursor.execute(sql)
                portfolios = cursor.fetchall()
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    return jsonify([serialize_db_row(row) for row in portfolios]), 200


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

    validation_error = validate_portfolio_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    name = data["name"]
    base_currency = data["base_currency"]

    sql = "INSERT INTO PORTFOLIO (name, base_currency) VALUES (%s, %s)"

    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(sql, (name, base_currency))
                    portfolio_id = cursor.lastrowid
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "id": portfolio_id,
        "name": name.strip(),
        "base_currency": base_currency,
        "message": "Portfolio created successfully",
    }), 201

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
        return jsonify(serialize_db_row(portfolio)), 200
    else:
        return jsonify({"error": "Portfolio not found"}), 404


@app.route("/api/portfolios/<portfolio_id>", methods=["PUT"])
def update_portfolio(portfolio_id):
    """Update the name and base currency of an existing portfolio."""
    data = request.get_json(silent=True)
    validation_error = validate_portfolio_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    sql = """
        UPDATE PORTFOLIO
        SET name = %s, base_currency = %s
        WHERE id = %s
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT id FROM PORTFOLIO WHERE id = %s",
                        (portfolio_id,),
                    )
                    if cursor.fetchone() is None:
                        return jsonify({"error": "Portfolio not found"}), 404

                    cursor.execute(
                        sql,
                        (data["name"].strip(), data["base_currency"], portfolio_id),
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "id": int(portfolio_id),
        "name": data["name"].strip(),
        "base_currency": data["base_currency"],
        "message": "Portfolio updated successfully",
    }), 200


@app.route("/api/portfolios/<portfolio_id>", methods=["DELETE"])
def delete_portfolio(portfolio_id):
    """Delete the portfolio identified by the URL path parameter.

    Inputs:
        portfolio_id: ID of the portfolio to delete.

    Expected outputs:
        HTTP 200 with a deletion message when the portfolio is deleted.
        HTTP 404 with an error message when it does not exist.
    """
    sql = "DELETE FROM PORTFOLIO WHERE id = %s"
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT id FROM HOLDING WHERE portfolio_id = %s LIMIT 1",
                        (portfolio_id,),
                    )
                    if cursor.fetchone() is not None:
                        return jsonify({
                            "error": (
                                "Portfolio cannot be deleted while it contains "
                                "holding transactions"
                            )
                        }), 409

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


@app.route("/api/holdings", methods=["GET"])
def list_holdings():
    """Return holdings for the portfolio specified by ``portfolio_id``."""
    portfolio_id = request.args.get("portfolio_id", type=int)
    if portfolio_id is None or portfolio_id <= 0:
        return jsonify({
            "error": "'portfolio_id' query parameter must be a positive integer"
        }), 400

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
        WHERE portfolio_id = %s
        ORDER BY traded_at DESC, id DESC
    """
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                cursor.execute(
                    "SELECT id FROM PORTFOLIO WHERE id = %s",
                    (portfolio_id,),
                )
                if cursor.fetchone() is None:
                    return jsonify({"error": "Portfolio not found"}), 404

                cursor.execute(sql, (portfolio_id,))
                holdings = cursor.fetchall()
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    return jsonify([serialize_db_row(row) for row in holdings]), 200


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
    validation_error = validate_holding_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

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

    return jsonify(serialize_db_row(holding)), 200


@app.route("/api/holdings/<holding_id>", methods=["PUT"])
def update_holding(holding_id):
    """Replace an existing holding transaction with validated values."""
    data = request.get_json(silent=True)
    validation_error = validate_holding_payload(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    sql = """
        UPDATE HOLDING
        SET
            portfolio_id = %s,
            ticker = %s,
            asset_name = %s,
            asset_type = %s,
            currency = %s,
            trade_type = %s,
            quantity = %s,
            price_per_unit = %s,
            fee_amount = %s,
            traded_at = %s
        WHERE id = %s
    """
    values = (
        data["portfolio_id"],
        data["ticker"].strip(),
        data["asset_name"].strip(),
        data["asset_type"].strip(),
        data["currency"],
        data["trade_type"],
        data["quantity"],
        data["price_per_unit"],
        data.get("fee_amount", 0.00),
        data["traded_at"],
        holding_id,
    )

    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT id FROM HOLDING WHERE id = %s",
                        (holding_id,),
                    )
                    if cursor.fetchone() is None:
                        return jsonify({"error": "Holding not found"}), 404

                    cursor.execute(
                        "SELECT id FROM PORTFOLIO WHERE id = %s",
                        (data["portfolio_id"],),
                    )
                    if cursor.fetchone() is None:
                        return jsonify({"error": "Portfolio not found"}), 404

                    cursor.execute(sql, values)
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                return jsonify({"error": str(error)}), 500
    except mysql.connector.Error as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "id": int(holding_id),
        "message": "Holding updated successfully",
    }), 200


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
