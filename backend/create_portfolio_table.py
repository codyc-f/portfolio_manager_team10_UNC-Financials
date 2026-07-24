"""
Creates the portfolio_manager database and PORTFOLIO table.
Run this after starting MySQL with `docker compose up -d` (see repo root):

    python create_portfolio_table.py
"""

import mysql.connector

# Matches the MySQL container defined in docker-compose.yml.
DB_HOST = "localhost"
DB_PORT = 3306
DB_USER = "root"
DB_PASSWORD = "devpassword"
DATABASE_NAME = "portfolio_manager"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS PORTFOLIO (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    base_currency VARCHAR(10) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
"""


def main():
    connection = mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    cursor = connection.cursor()

    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DATABASE_NAME}")
    cursor.execute(f"USE {DATABASE_NAME}")
    cursor.execute(CREATE_TABLE_SQL)
    connection.commit()

    print(f"PORTFOLIO table is ready in the '{DATABASE_NAME}' database.")

    cursor.close()
    connection.close()


if __name__ == "__main__":
    main()
