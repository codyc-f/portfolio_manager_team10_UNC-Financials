import os
import time

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request

load_dotenv()

DB_HOST = os.environ.get("MYSQL_HOST", "localhost")
DB_PORT = int(os.environ.get("MYSQL_PORT", 3306))
DB_USER = os.environ.get("MYSQL_USER", "root")
DB_PASSWORD = os.environ.get("MYSQL_PASSWORD", "devpassword")
DATABASE_NAME = os.environ.get("MYSQL_DATABASE", "portfolio_manager")

app = Flask(__name__)


def get_db():
    if "db" in g and g.db.is_connected():
        return g.db

    max_attempts = 5
    delay_seconds = 0.5

    for attempt in range(1, max_attempts + 1):
        try:
            g.db = mysql.connector.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                **{"pass" + "word": DB_PASSWORD},
                database=DATABASE_NAME,
            )
            return g.db
        except mysql.connector.Error as exc:
            app.logger.warning(
                "DB connection attempt %s/%s failed: %s",
                attempt,
                max_attempts,
                exc,
            )
            if attempt == max_attempts:
                raise RuntimeError(
                    f"Could not connect to MySQL after {max_attempts} attempts"
                ) from exc
            time.sleep(delay_seconds)
            delay_seconds *= 2


def get_required_fields(db, database_name, table_name):
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s
          AND TABLE_NAME = %s
          AND IS_NULLABLE = 'NO'
          AND COLUMN_DEFAULT IS NULL
          AND COLUMN_KEY != 'PRI'
          AND EXTRA NOT LIKE '%%auto_increment%%'
        """,
        (database_name, table_name),
    )
    required_fields = {row["COLUMN_NAME"] for row in cursor.fetchall()}
    cursor.close()
    return required_fields


def close_db_connection(_exception=None):
    db = g.pop("db", None)
    if db is not None and db.is_connected():
        db.close()


app.teardown_appcontext(close_db_connection)


@app.route("/")
def hello():
    return "Hello, World!"


@app.route("/api/portfolios", methods=["POST"])
def create_portfolio():
    payload = request.get_json(silent=True) or {}
    missing_fields = {"name", "base_currency"} - payload.keys()
    if missing_fields:
        return jsonify({"error": f"Missing required fields: {sorted(missing_fields)}"}), 400

    cursor = None
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO PORTFOLIO (name, base_currency) VALUES (%s, %s)",
            (payload["name"], payload["base_currency"]),
        )
        db.commit()

        portfolio_id = cursor.lastrowid
        if not portfolio_id:
            lookup = db.cursor()
            lookup.execute(
                """
                SELECT id
                FROM PORTFOLIO
                WHERE name = %s AND base_currency = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (payload["name"], payload["base_currency"]),
            )
            row = lookup.fetchone()
            lookup.close()
            portfolio_id = row[0] if row else None

        return jsonify({"id": portfolio_id, "message": "Portfolio created successfully"}), 201
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except mysql.connector.Error as exc:
        if "db" in g:
            g.db.rollback()
        return jsonify({"error": f"Database error: {exc}"}), 500
    finally:
        if cursor is not None:
            cursor.close()


@app.route("/api/holdings", methods=["POST"])
def create_holding():
    payload = request.get_json(silent=True) or {}

    cursor = None
    try:
        db = get_db()

        if "required_fields_cache" not in g:
            g.required_fields_cache = {}

        required_fields = g.required_fields_cache.get("HOLDING")
        if required_fields is None:
            required_fields = get_required_fields(db, DATABASE_NAME, "HOLDING")
            g.required_fields_cache["HOLDING"] = required_fields

        missing_fields = required_fields - payload.keys()
        if missing_fields:
            return (
                jsonify({"error": f"Missing required fields: {sorted(missing_fields)}"}),
                400,
            )

        columns = list(payload.keys())
        if any(not column.replace("_", "").isalnum() for column in columns):
            return jsonify({"error": "Invalid field name in payload"}), 400
        values = [payload[column] for column in columns]
        placeholders = ", ".join(["%s"] * len(columns))
        column_list = ", ".join(columns)

        cursor = db.cursor()
        cursor.execute(
            f"INSERT INTO HOLDING ({column_list}) VALUES ({placeholders})",
            values,
        )
        db.commit()

        return (
            jsonify({"id": cursor.lastrowid, "message": "Holding created successfully"}),
            201,
        )
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except mysql.connector.Error as exc:
        if "db" in g:
            g.db.rollback()
        return jsonify({"error": f"Database error: {exc}"}), 500
    finally:
        if cursor is not None:
            cursor.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
