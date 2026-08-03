import os

import mysql.connector
import pytest

from table_initializer import CREATE_HOLDING_TABLE_SQL, CREATE_PORTFOLIO_TABLE_SQL
from tests.conftest import integration_enabled


pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def db_config():
    if not integration_enabled():
        pytest.skip("Set RUN_DB_INTEGRATION_TESTS=1 to run database tests")

    return {
        "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
        "port": int(os.environ.get("MYSQL_PORT", 3306)),
        "user": os.environ.get("MYSQL_USER", "root"),
        "password": os.environ.get("MYSQL_PASSWORD", "devpassword"),
        "database": os.environ.get("MYSQL_DATABASE", "portfolio_manager_test"),
    }


@pytest.fixture()
def connection(db_config):
    admin = mysql.connector.connect(
        host=db_config["host"],
        port=db_config["port"],
        user=db_config["user"],
        password=db_config["password"],
    )
    cursor = admin.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_config['database']}")
    cursor.execute(f"USE {db_config['database']}")
    cursor.execute("DROP TABLE IF EXISTS HOLDING")
    cursor.execute("DROP TABLE IF EXISTS PORTFOLIO")
    cursor.execute(CREATE_PORTFOLIO_TABLE_SQL)
    cursor.execute(CREATE_HOLDING_TABLE_SQL)
    admin.commit()
    cursor.close()
    admin.close()

    test_connection = mysql.connector.connect(**db_config)
    yield test_connection
    test_connection.close()


def test_portfolio_and_holding_crud_against_mysql(connection):
    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        INSERT INTO PORTFOLIO (name, base_currency, balance)
        VALUES (%s, %s, %s)
        """,
        ("Integration Portfolio", "USD", 10000),
    )
    portfolio_id = cursor.lastrowid

    cursor.execute(
        """
        INSERT INTO HOLDING (
            portfolio_id, ticker, asset_name, asset_type, currency, trade_type,
            quantity, price_per_unit, fee_amount, traded_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            portfolio_id,
            "AAPL",
            "Apple Inc.",
            "STOCK",
            "USD",
            "BUY",
            2,
            150,
            1,
            "2026-07-27 14:30:00",
        ),
    )
    holding_id = cursor.lastrowid
    connection.commit()

    cursor.execute("SELECT name, balance FROM PORTFOLIO WHERE id = %s", (portfolio_id,))
    portfolio = cursor.fetchone()
    assert portfolio["name"] == "Integration Portfolio"

    cursor.execute("SELECT ticker, quantity FROM HOLDING WHERE id = %s", (holding_id,))
    holding = cursor.fetchone()
    assert holding["ticker"] == "AAPL"

    cursor.execute(
        "UPDATE HOLDING SET quantity = %s WHERE id = %s",
        (3, holding_id),
    )
    cursor.execute("DELETE FROM HOLDING WHERE id = %s", (holding_id,))
    cursor.execute("DELETE FROM PORTFOLIO WHERE id = %s", (portfolio_id,))
    connection.commit()

    cursor.execute("SELECT id FROM PORTFOLIO WHERE id = %s", (portfolio_id,))
    assert cursor.fetchone() is None
