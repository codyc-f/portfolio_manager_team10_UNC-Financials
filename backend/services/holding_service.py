from decimal import Decimal

import mysql.connector

from db import get_connection
from market_data import get_company_logo_url, get_current_price
from repositories import holding_repository, portfolio_repository
from serializers import serialize_db_row
from services.errors import (
    BadRequestError,
    ExternalServiceError,
    ConflictError,
    NotFoundError,
    ServiceError,
)
from services.position_service import build_positions_from_transactions


def list_holdings(portfolio_id):
    """Return all holding transaction rows for one portfolio.

    This is needed so the API can show the raw BUY and SELL history for a
    portfolio. It is used by the GET /api/holdings endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                # Confirm the portfolio exists before reading its holdings
                if not portfolio_repository.portfolio_exists(
                    cursor,
                    portfolio_id,
                ):
                    raise NotFoundError("Portfolio not found")

                # Load all transaction rows attached to this portfolio
                holdings = holding_repository.list_holdings_for_portfolio(
                    cursor,
                    portfolio_id,
                )
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    # Convert database rows into JSON-friendly values before returning
    return [serialize_db_row(row) for row in holdings]


def list_positions(portfolio_id):
    """Return active positions calculated from holding transactions.

    This is needed because the database stores transaction rows, not a live
    position table. It is used by the GET /api/portfolios/<portfolio_id>/positions
    endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            with connection.cursor(dictionary=True) as cursor:
                # Confirm the portfolio exists before calculating positions
                if not portfolio_repository.portfolio_exists(
                    cursor,
                    portfolio_id,
                ):
                    raise NotFoundError("Portfolio not found")

                # Load transactions because positions are calculated from buys and sells
                transactions = holding_repository.list_position_transactions(
                    cursor,
                    portfolio_id,
                )
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    try:
        positions_without_prices = build_positions_from_transactions(transactions)
    except ValueError as error:
        raise ConflictError(str(error)) from error

    # Pull current prices for each active ticker so market value can be calculated
    tickers = [position["ticker"] for position in positions_without_prices]
    current_prices = {}
    try:
        for ticker in tickers:
            current_prices[ticker] = get_current_price(ticker)
    except Exception as error:
        raise ExternalServiceError(str(error)) from error

    positions = build_positions_from_transactions(transactions, current_prices)
    for position in positions:
        try:
            # Add company logo when the market data provider has one available
            position["logo_url"] = get_company_logo_url(position["ticker"])
        except Exception:
            position["logo_url"] = None

    return positions


def create_holding(data):
    """Create one BUY or SELL holding transaction and update portfolio cash.

    This is needed so every trade is saved while keeping the portfolio balance
    in sync. It is used by the POST /api/holdings endpoint in app.py.
    """
    # Convert numeric request fields to Decimal before doing money calculations
    quantity = Decimal(str(data["quantity"]))
    price_per_unit = Decimal(str(data["price_per_unit"]))
    fee_amount = Decimal(str(data.get("fee_amount", 0.00)))
    # Trade value is the number of units times the transaction price
    trade_value = quantity * price_per_unit
    # BUY decreases cash balance, SELL increases cash balance after fees
    if data["trade_type"] == "BUY":
        balance_delta = -(trade_value + fee_amount)
    else:
        balance_delta = trade_value - fee_amount

    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    # Load the portfolio balance so the transaction can update cash
                    portfolio = portfolio_repository.get_portfolio_balance(
                        cursor,
                        data["portfolio_id"],
                    )
                    if portfolio is None:
                        raise NotFoundError("Portfolio not found")

                    # Calculate what the balance will be after this transaction
                    next_balance = portfolio["balance"] + balance_delta
                    if next_balance < 0:
                        raise BadRequestError(
                            "Insufficient portfolio balance for this BUY"
                        )

                    if data["trade_type"] == "SELL":
                        # Prevent selling more shares than currently owned
                        _ensure_enough_shares_to_sell(cursor, data, quantity)

                    # Save the holding transaction and update portfolio cash together
                    holding_id = holding_repository.create_holding(cursor, data)
                    portfolio_repository.update_portfolio_balance(
                        cursor,
                        data["portfolio_id"],
                        next_balance.quantize(Decimal("0.01")),
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    # Return the holding id and the portfolio balance after the transaction
    return {
        "id": holding_id,
        "portfolio_balance": str(next_balance.quantize(Decimal("0.01"))),
        "message": (
            "Successfully created holding with holding_id "
            f"{holding_id} & portfolio_id {data['portfolio_id']}"
        ),
    }


def get_holding(holding_id):
    """Return one holding transaction by id.

    This is needed so the API can show the details for a single transaction.
    It is used by the GET /api/holdings/<holding_id> endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor(dictionary=True) as cursor:
                    # Look up one holding transaction by its primary key
                    holding = holding_repository.get_holding_by_id(
                        cursor,
                        holding_id,
                    )
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    if holding is None:
        raise NotFoundError("Holding not found")

    # Convert database values into JSON-friendly values before returning
    return serialize_db_row(holding)


def update_holding(holding_id, data):
    """Update one existing holding transaction.

    This is needed so transaction details can be corrected after creation.
    It is used by the PUT /api/holdings/<holding_id> endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    # Confirm the holding exists before trying to update it
                    if not holding_repository.holding_exists(cursor, holding_id):
                        raise NotFoundError("Holding not found")

                    # Confirm the target portfolio exists before linking the holding
                    if not portfolio_repository.portfolio_exists(
                        cursor,
                        data["portfolio_id"],
                    ):
                        raise NotFoundError("Portfolio not found")

                    # Save updated holding fields and commit the transaction
                    holding_repository.update_holding(cursor, holding_id, data)
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    return {
        "id": int(holding_id),
        "message": "Holding updated successfully",
    }


def delete_holding(holding_id):
    """Delete one holding transaction by id.

    This is needed so an incorrect transaction can be removed from the
    portfolio history. It is used by the DELETE /api/holdings/<holding_id>
    endpoint in app.py.
    """
    try:
        with get_connection() as connection:
            try:
                with connection.cursor() as cursor:
                    # Delete the holding row and use the row count to detect missing ids
                    deleted = holding_repository.delete_holding(
                        cursor,
                        holding_id,
                    )
                    connection.commit()
            except mysql.connector.Error as error:
                connection.rollback()
                raise ServiceError(str(error)) from error
    except mysql.connector.Error as error:
        raise ServiceError(str(error)) from error

    if not deleted:
        raise NotFoundError("Holding not found")

    return {"message": f"Successfully deleted holding with id {holding_id}"}


def _ensure_enough_shares_to_sell(cursor, data, quantity):
    """Stop a SELL transaction when the portfolio does not own enough shares.

    This is needed to prevent negative positions. It is used only inside
    create_holding before a SELL transaction is saved.
    """
    # Load only transactions for the asset being sold
    transactions = holding_repository.list_position_transactions_for_asset(
        cursor,
        data["portfolio_id"],
        data["ticker"],
        data["currency"],
    )
    # Build the current open position from the asset transaction history
    current_positions = build_positions_from_transactions(transactions)
    current_position = None
    for position in current_positions:
        if (
            position["ticker"] == data["ticker"]
            and position["currency"] == data["currency"]
        ):
            current_position = position
            break

    # Treat missing position as zero shares owned
    if current_position:
        quantity_owned = Decimal(str(current_position["quantity_owned"]))
    else:
        quantity_owned = Decimal("0")

    # Prevent a SELL transaction that would make the position negative
    if quantity_owned < quantity:
        raise BadRequestError("Cannot sell more shares than owned")
