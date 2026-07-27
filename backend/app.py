import os
from flask import Flask, request, jsonify
import mysql.connector
from dotenv import load_dotenv
from helper_functions import get_required_fields

load_dotenv()  # reads .env from the repo root, if present

app = Flask(__name__)

DB_HOST = os.environ.get("MYSQL_HOST", "localhost")
DB_PORT = int(os.environ.get("MYSQL_PORT", 3306))
DB_USER = os.environ.get("MYSQL_USER", "root")
DB_PASSWORD = os.environ.get("MYSQL_PASSWORD", "devpassword")
DATABASE_NAME = os.environ.get("MYSQL_DATABASE", "portfolio_manager")


# Establish the database connection
db = mysql.connector.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DATABASE_NAME,
)

HOLDING_REQUIRED_FIELDS = get_required_fields(db, DATABASE_NAME, "HOLDING")

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
    # 1. Parse the incoming JSON body from the request
    data = request.get_json()

    # Simple validation to ensure required fields exist
    if not data or 'name' not in data or 'base_currency' not in data:
        return jsonify({"error": "Missing required fields: 'name' and 'base_currency'"}), 400

    name = data['name']
    base_currency = data['base_currency']

    # 2. Get a cursor to run the query
    cursor = db.cursor()

    # 3. Use parameter placeholders (%s) to safely insert data
    sql = "INSERT INTO PORTFOLIO (name, base_currency) VALUES (%s, %s)"

    # 4. Execute the query with data provided in a tuple[cite: 1]
    cursor.execute(sql, (name, base_currency))

    # 5. Commit the changes to the database[cite: 1]
    db.commit()
    cursor.close()

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
    # Get a cursor. Passing dictionary=True makes it easier to convert the row to JSON later.
    cursor = db.cursor(dictionary=True)

    # Use the %s placeholder for the WHERE clause to prevent SQL injection
    sql = "SELECT id, name, base_currency, created_at, updated_at FROM PORTFOLIO WHERE id = %s"

    # Execute the query, passing the portfolio_id in a tuple
    cursor.execute(sql, (portfolio_id,))

    # Fetch a single record
    portfolio = cursor.fetchone()

    cursor.close()

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
    cursor = db.cursor()

    # Use a parameterized query so the portfolio ID is never treated as SQL.
    sql = "DELETE FROM PORTFOLIO WHERE id = %s"
    cursor.execute(sql, (portfolio_id,))
    deleted = cursor.rowcount > 0

    db.commit()
    cursor.close()

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

    cursor = db.cursor()

    # Give a clear response instead of relying on a foreign-key database error.
    cursor.execute(
        "SELECT id FROM PORTFOLIO WHERE id = %s",
        (data["portfolio_id"],),
    )
    if cursor.fetchone() is None:
        cursor.close()
        return jsonify({"error": "Portfolio not found"}), 404

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
    cursor.execute(sql, values)
    holding_id = cursor.lastrowid

    db.commit()
    cursor.close()

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
    cursor = db.cursor(dictionary=True)

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
    cursor.execute(sql, (holding_id,))
    holding = cursor.fetchone()
    cursor.close()

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
    cursor = db.cursor()

    sql = "DELETE FROM HOLDING WHERE id = %s"
    cursor.execute(sql, (holding_id,))
    deleted = cursor.rowcount > 0

    db.commit()
    cursor.close()

    if not deleted:
        return jsonify({"error": "Holding not found"}), 404

    return jsonify({
        "message": f"Successfully deleted holding with id {holding_id}"
    }), 200



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
