import os

import mysql.connector
from dotenv import load_dotenv

load_dotenv()  # reads .env from the repo root, if present

DB_HOST = os.environ.get("MYSQL_HOST", "localhost")
DB_PORT = int(os.environ.get("MYSQL_PORT", 3306))
DB_USER = os.environ.get("MYSQL_USER", "root")
DB_PASSWORD = os.environ.get("MYSQL_PASSWORD", "devpassword")
DATABASE_NAME = os.environ.get("MYSQL_DATABASE", "portfolio_manager")


def get_connection():
    """Create a new MySQL connection using the configured environment values."""
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DATABASE_NAME,
    )
