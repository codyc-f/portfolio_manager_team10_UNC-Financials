def list_portfolios(cursor):
    cursor.execute(
        """
        SELECT id, name, base_currency, balance, created_at, updated_at
        FROM PORTFOLIO
        ORDER BY created_at ASC, id ASC
        """
    )
    return cursor.fetchall()


def get_portfolio_by_id(cursor, portfolio_id):
    cursor.execute(
        """
        SELECT id, name, base_currency, balance, created_at, updated_at
        FROM PORTFOLIO
        WHERE id = %s
        """,
        (portfolio_id,),
    )
    return cursor.fetchone()


def portfolio_exists(cursor, portfolio_id):
    cursor.execute("SELECT id FROM PORTFOLIO WHERE id = %s", (portfolio_id,))
    return cursor.fetchone() is not None


def get_portfolio_balance(cursor, portfolio_id):
    cursor.execute(
        "SELECT id, balance FROM PORTFOLIO WHERE id = %s",
        (portfolio_id,),
    )
    return cursor.fetchone()


def create_portfolio(cursor, name, base_currency, balance):
    cursor.execute(
        """
        INSERT INTO PORTFOLIO (name, base_currency, balance)
        VALUES (%s, %s, %s)
        """,
        (name, base_currency, balance),
    )
    return cursor.lastrowid


def update_portfolio(cursor, portfolio_id, name, base_currency, balance):
    cursor.execute(
        """
        UPDATE PORTFOLIO
        SET name = %s, base_currency = %s, balance = %s
        WHERE id = %s
        """,
        (name, base_currency, balance, portfolio_id),
    )


def update_portfolio_balance(cursor, portfolio_id, balance):
    cursor.execute(
        "UPDATE PORTFOLIO SET balance = %s WHERE id = %s",
        (balance, portfolio_id),
    )


def delete_portfolio(cursor, portfolio_id):
    cursor.execute("DELETE FROM PORTFOLIO WHERE id = %s", (portfolio_id,))
    return cursor.rowcount > 0
