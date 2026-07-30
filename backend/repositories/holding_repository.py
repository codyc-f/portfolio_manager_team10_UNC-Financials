def holding_exists(cursor, holding_id):
    cursor.execute("SELECT id FROM HOLDING WHERE id = %s", (holding_id,))
    return cursor.fetchone() is not None


def portfolio_has_holdings(cursor, portfolio_id):
    cursor.execute(
        "SELECT id FROM HOLDING WHERE portfolio_id = %s LIMIT 1",
        (portfolio_id,),
    )
    return cursor.fetchone() is not None


def list_holdings_for_portfolio(cursor, portfolio_id):
    cursor.execute(
        """
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
        """,
        (portfolio_id,),
    )
    return cursor.fetchall()


def list_position_transactions(cursor, portfolio_id):
    cursor.execute(
        """
        SELECT
            ticker,
            asset_name,
            asset_type,
            currency,
            trade_type,
            quantity,
            price_per_unit,
            fee_amount
        FROM HOLDING
        WHERE portfolio_id = %s
        ORDER BY ticker ASC, currency ASC, traded_at ASC, id ASC
        """,
        (portfolio_id,),
    )
    return cursor.fetchall()


def list_position_transactions_for_asset(cursor, portfolio_id, ticker, currency):
    cursor.execute(
        """
        SELECT
            ticker,
            asset_name,
            asset_type,
            currency,
            trade_type,
            quantity,
            price_per_unit,
            fee_amount
        FROM HOLDING
        WHERE portfolio_id = %s
          AND ticker = %s
          AND currency = %s
        ORDER BY traded_at ASC, id ASC
        """,
        (portfolio_id, ticker, currency),
    )
    return cursor.fetchall()


def create_holding(cursor, data):
    cursor.execute(
        """
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
        """,
        (
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
        ),
    )
    return cursor.lastrowid


def get_holding_by_id(cursor, holding_id):
    cursor.execute(
        """
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
        """,
        (holding_id,),
    )
    return cursor.fetchone()


def update_holding(cursor, holding_id, data):
    cursor.execute(
        """
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
        """,
        (
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
        ),
    )


def delete_holding(cursor, holding_id):
    cursor.execute("DELETE FROM HOLDING WHERE id = %s", (holding_id,))
    return cursor.rowcount > 0
